from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import numpy as np
from sklearn.cluster import KMeans
from sqlalchemy import func, inspect
from sqlalchemy.orm import Session

from . import models, schemas


METRICS = [
    "attack_point",
    "attack_fault",
    "attack_rally_continue",
    "serve_point",
    "serve_fault",
    "serve_rally_continue",
    "reception_positive",
    "reception_double_positive",
    "reception_fault",
    "block",
    "block_out",
]


@dataclass(frozen=True)
class PlayerAgg:
    player_id: int
    first_name: str
    last_name: str
    team_id: int
    team_name: str
    totals: dict[str, float]


def _zscore(x: np.ndarray) -> np.ndarray:
    mu = x.mean(axis=0)
    sigma = x.std(axis=0)
    sigma = np.where(sigma == 0, 1.0, sigma)
    return (x - mu) / sigma


def _safe_rate(num: float, den: float) -> float:
    if den <= 0:
        return 0.0
    return float(num) / float(den)


def _features(p: PlayerAgg) -> list[float]:
    t = p.totals
    att_total = float(t.get("attack_point", 0) + t.get("attack_fault", 0) + t.get("attack_rally_continue", 0))
    srv_total = float(t.get("serve_point", 0) + t.get("serve_fault", 0) + t.get("serve_rally_continue", 0))
    rec_total = float(t.get("reception_positive", 0) + t.get("reception_double_positive", 0) + t.get("reception_fault", 0))
    blk_total = float(t.get("block", 0) + t.get("block_out", 0))

    attack_eff = _safe_rate(float(t.get("attack_point", 0)) - float(t.get("attack_fault", 0)), att_total)
    serve_eff = _safe_rate(float(t.get("serve_point", 0)) - float(t.get("serve_fault", 0)), srv_total)
    reception_q = _safe_rate(float(t.get("reception_positive", 0)) + 1.5 * float(t.get("reception_double_positive", 0)), rec_total)
    block_out_rate = _safe_rate(float(t.get("block_out", 0)), blk_total)

    volume = att_total + srv_total + rec_total + blk_total

    return [
        attack_eff,
        _safe_rate(float(t.get("attack_fault", 0)), att_total),
        serve_eff,
        _safe_rate(float(t.get("serve_fault", 0)), srv_total),
        reception_q,
        _safe_rate(float(t.get("reception_fault", 0)), rec_total),
        _safe_rate(float(t.get("block", 0)), blk_total),
        block_out_rate,
        np.log1p(volume),
    ]


FEATURE_NAMES = [
    "attack_efficiency",
    "attack_fault_rate",
    "serve_efficiency",
    "serve_fault_rate",
    "reception_quality",
    "reception_fault_rate",
    "block_in_rate",
    "block_out_rate",
    "log_volume",
]


def category_player_aggregates(db: Session, gender: str, competition: str) -> list[PlayerAgg]:
    if not inspect(db.get_bind()).has_table("stat_records"):
        return []

    rows = (
        db.query(
            models.Player.id,
            models.Player.first_name,
            models.Player.last_name,
            models.Team.id,
            models.Team.name,
            models.StatRecord.metric_key,
            func.sum(models.StatRecord.value),
        )
        .join(models.Team, models.Team.id == models.Player.team_id)
        .join(models.StatRecord, models.StatRecord.player_id == models.Player.id)
        .filter(models.Team.gender == gender)
        .filter(models.Team.competition == competition)
        .filter(models.StatRecord.metric_key.in_(METRICS))
        .group_by(
            models.Player.id,
            models.Player.first_name,
            models.Player.last_name,
            models.Team.id,
            models.Team.name,
            models.StatRecord.metric_key,
        )
        .all()
    )

    by_player: dict[int, PlayerAgg] = {}
    for pid, fn, ln, tid, tname, key, total in rows:
        pid_i = int(pid)
        if pid_i not in by_player:
            by_player[pid_i] = PlayerAgg(
                player_id=pid_i,
                first_name=str(fn),
                last_name=str(ln),
                team_id=int(tid),
                team_name=str(tname),
                totals={},
            )
        by_player[pid_i].totals[str(key)] = float(total or 0)

    return list(by_player.values())


def build_insights(
    db: Session,
    team_id: int,
    gender: str,
    competition: str,
    k: int = 4,
) -> schemas.TeamScoutingInsightsResponse:
    players = category_player_aggregates(db, gender, competition)
    if not players:
        return schemas.TeamScoutingInsightsResponse(
            team_id=team_id,
            gender=gender,
            competition=competition,
            players=[],
            best_worst_by_action=[],
            model_insights=[],
        )

    X = np.asarray([_features(p) for p in players], dtype=float)
    Z = _zscore(X)

    n = len(players)
    if n < 2:
        clusters = np.zeros((n,), dtype=int)
    else:
        kk = int(max(2, min(k, n)))
        km = KMeans(n_clusters=kk, random_state=42, n_init="auto")
        clusters = km.fit_predict(Z)

    out: list[schemas.PlayerInsight] = []
    for i, p in enumerate(players):
        if int(p.team_id) != int(team_id):
            continue
        order_high = [int(x) for x in np.argsort(-Z[i]).tolist()]
        order_low = [int(x) for x in np.argsort(Z[i]).tolist()]

        strengths_i: list[int] = []
        for j in order_high:
          if j not in strengths_i:
            strengths_i.append(j)
          if len(strengths_i) >= 2:
            break

        vulns_i: list[int] = []
        for j in order_low:
          if j in strengths_i:
            continue
          if j not in vulns_i:
            vulns_i.append(j)
          if len(vulns_i) >= 2:
            break

        strengths = [FEATURE_NAMES[j].replace("_", " ").title() for j in strengths_i]
        vulnerabilities = [FEATURE_NAMES[j].replace("_", " ").title() for j in vulns_i]
        out.append(
            schemas.PlayerInsight(
                player_id=p.player_id,
                first_name=p.first_name,
                last_name=p.last_name,
                team_id=p.team_id,
                team_name=p.team_name,
                strengths=strengths,
                vulnerabilities=vulnerabilities,
                cluster_id=int(clusters[i]),
            )
        )

    out.sort(key=lambda x: (x.last_name, x.first_name))

    def _action_totals(p: PlayerAgg):
        t = p.totals
        att_total = float(t.get("attack_point", 0) + t.get("attack_fault", 0) + t.get("attack_rally_continue", 0))
        srv_total = float(t.get("serve_point", 0) + t.get("serve_fault", 0) + t.get("serve_rally_continue", 0))
        rec_total = float(t.get("reception_positive", 0) + t.get("reception_double_positive", 0) + t.get("reception_fault", 0))
        blk_total = float(t.get("block", 0) + t.get("block_out", 0))
        return att_total, srv_total, rec_total, blk_total

    def _score_attack(p: PlayerAgg) -> float | None:
        t = p.totals
        att_total, _, _, _ = _action_totals(p)
        if att_total <= 0:
            return None
        points = float(t.get("attack_point", 0))
        faults = float(t.get("attack_fault", 0))
        return _safe_rate(points - faults, att_total)

    def _score_serve(p: PlayerAgg) -> float | None:
        t = p.totals
        _, srv_total, _, _ = _action_totals(p)
        if srv_total <= 0:
            return None
        points = float(t.get("serve_point", 0))
        faults = float(t.get("serve_fault", 0))
        return _safe_rate(points - faults, srv_total)

    def _score_reception(p: PlayerAgg) -> float | None:
        t = p.totals
        _, _, rec_total, _ = _action_totals(p)
        if rec_total <= 0:
            return None
        pos = float(t.get("reception_positive", 0))
        dpos = float(t.get("reception_double_positive", 0))
        fault = float(t.get("reception_fault", 0))
        return _safe_rate(pos + 1.5 * dpos - fault, rec_total)

    def _score_block(p: PlayerAgg) -> float | None:
        t = p.totals
        _, _, _, blk_total = _action_totals(p)
        if blk_total <= 0:
            return None
        blk = float(t.get("block", 0))
        outb = float(t.get("block_out", 0))
        return _safe_rate(blk - outb, blk_total)

    team_players = [p for p in players if int(p.team_id) == int(team_id)]

    def _best_worst(action: schemas.ScoutingAction, scorer):
        scored: list[tuple[PlayerAgg, float]] = []
        for p in team_players:
            s = scorer(p)
            if s is None:
                continue
            scored.append((p, float(s)))
        if not scored:
            return schemas.ActionBestWorst(action=action, best=None, worst=None)
        scored.sort(key=lambda x: (x[1], x[0].first_name, x[0].last_name))
        worst_p, worst_s = scored[0]
        best_p, best_s = scored[-1]
        return schemas.ActionBestWorst(
            action=action,
            best=schemas.PlayerActionScore(
                player_id=best_p.player_id,
                first_name=best_p.first_name,
                last_name=best_p.last_name,
                team_id=best_p.team_id,
                team_name=best_p.team_name,
                score=float(best_s),
            ),
            worst=schemas.PlayerActionScore(
                player_id=worst_p.player_id,
                first_name=worst_p.first_name,
                last_name=worst_p.last_name,
                team_id=worst_p.team_id,
                team_name=worst_p.team_name,
                score=float(worst_s),
            ),
        )

    best_worst = [
        _best_worst("attack", _score_attack),
        _best_worst("serve", _score_serve),
        _best_worst("reception", _score_reception),
        _best_worst("block", _score_block),
    ]

    def _beta_adjusted_rate(success: float, attempts: float, baseline_rate: float, prior_strength: int) -> float:
        a0 = max(1e-9, float(baseline_rate) * float(prior_strength))
        b0 = max(1e-9, float(1.0 - float(baseline_rate)) * float(prior_strength))
        return float(success + a0) / float(attempts + a0 + b0)

    def _make_rate_stat(p: PlayerAgg, attempts: float, raw_rate: float, adjusted_rate: float) -> schemas.ModelRateStat:
        return schemas.ModelRateStat(
            player_id=p.player_id,
            first_name=p.first_name,
            last_name=p.last_name,
            team_id=p.team_id,
            team_name=p.team_name,
            attempts=int(attempts),
            raw_rate=float(raw_rate),
            adjusted_rate=float(adjusted_rate),
        )

    def _model_action(
        action: schemas.ScoutingAction,
        metric_name: str,
        get_counts,
        prior_strength: int,
        min_attempts_high_volume: int,
    ) -> schemas.ModelActionInsight:
        cat_attempts = 0.0
        cat_success = 0.0
        for p in players:
            s, n = get_counts(p)
            cat_success += float(s)
            cat_attempts += float(n)
        baseline = _safe_rate(cat_success, cat_attempts) if cat_attempts > 0 else 0.0

        rows: list[tuple[PlayerAgg, float, float, float]] = []
        for p in team_players:
            s, n = get_counts(p)
            if float(n) <= 0:
                continue
            raw = _safe_rate(float(s), float(n))
            adj = _beta_adjusted_rate(float(s), float(n), baseline, prior_strength)
            rows.append((p, float(n), float(raw), float(adj)))

        best_adj = None
        best_hv = None
        best_raw = None

        if rows:
            best_adj_t = max(rows, key=lambda x: (x[3], x[1], x[0].last_name, x[0].first_name))
            best_adj = _make_rate_stat(best_adj_t[0], best_adj_t[1], best_adj_t[2], best_adj_t[3])

            raw_t = max(rows, key=lambda x: (x[2], x[1], x[0].last_name, x[0].first_name))
            best_raw = _make_rate_stat(raw_t[0], raw_t[1], raw_t[2], raw_t[3])

            hv = [r for r in rows if r[1] >= float(min_attempts_high_volume)]
            if hv:
                hv_t = max(hv, key=lambda x: (x[3], x[1], x[0].last_name, x[0].first_name))
                best_hv = _make_rate_stat(hv_t[0], hv_t[1], hv_t[2], hv_t[3])

        notes: list[str] = []
        if best_raw and best_hv and best_raw.player_id != best_hv.player_id:
            if best_raw.attempts < min_attempts_high_volume:
                notes.append(
                    f"Top raw rate is {best_raw.first_name} {best_raw.last_name} ({best_raw.raw_rate:.1%}) but on a small sample ({best_raw.attempts} attempts)."
                )
                notes.append(
                    f"Best among high-volume players is {best_hv.first_name} {best_hv.last_name} ({best_hv.raw_rate:.1%} raw, {best_hv.adjusted_rate:.1%} adjusted) with {best_hv.attempts} attempts."
                )
        if best_adj and best_adj.attempts < min_attempts_high_volume:
            notes.append(
                f"Adjusted leader is {best_adj.first_name} {best_adj.last_name} ({best_adj.adjusted_rate:.1%}) but still with limited volume ({best_adj.attempts} attempts)."
            )

        return schemas.ModelActionInsight(
            action=action,
            metric_name=metric_name,
            prior_strength=int(prior_strength),
            category_baseline_rate=float(baseline),
            min_attempts_high_volume=int(min_attempts_high_volume),
            best_adjusted=best_adj,
            best_high_volume=best_hv,
            best_raw_rate=best_raw,
            notes=notes,
        )

    def _counts_reception(p: PlayerAgg) -> tuple[float, float]:
        t = p.totals
        n = float(t.get("reception_positive", 0) + t.get("reception_double_positive", 0) + t.get("reception_fault", 0))
        s = float(t.get("reception_positive", 0) + t.get("reception_double_positive", 0))
        return s, n

    def _counts_attack(p: PlayerAgg) -> tuple[float, float]:
        t = p.totals
        n = float(t.get("attack_point", 0) + t.get("attack_fault", 0) + t.get("attack_rally_continue", 0))
        s = float(t.get("attack_point", 0))
        return s, n

    def _counts_serve(p: PlayerAgg) -> tuple[float, float]:
        t = p.totals
        n = float(t.get("serve_point", 0) + t.get("serve_fault", 0) + t.get("serve_rally_continue", 0))
        s = float(t.get("serve_point", 0))
        return s, n

    def _counts_block(p: PlayerAgg) -> tuple[float, float]:
        t = p.totals
        n = float(t.get("block", 0) + t.get("block_out", 0))
        s = float(t.get("block", 0))
        return s, n

    model_insights = [
        _model_action("reception", "Reception success rate", _counts_reception, prior_strength=20, min_attempts_high_volume=30),
        _model_action("attack", "Attack point rate", _counts_attack, prior_strength=20, min_attempts_high_volume=25),
        _model_action("serve", "Serve point rate", _counts_serve, prior_strength=20, min_attempts_high_volume=25),
        _model_action("block", "Block in-play rate", _counts_block, prior_strength=20, min_attempts_high_volume=15),
    ]

    return schemas.TeamScoutingInsightsResponse(
        team_id=team_id,
        gender=gender,
        competition=competition,
        players=out,
        best_worst_by_action=best_worst,
        model_insights=model_insights,
    )


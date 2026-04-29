from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator

from .models import TeamCompetition, TeamGender


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None


class UserBase(BaseModel):
    username: str


class UserCreate(UserBase):
    password: str
    role: str


class CoachRegister(UserBase):
    password: str


class User(UserBase):
    id: int
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class TeamCreate(BaseModel):
    name: str
    gender: TeamGender
    competition: TeamCompetition


class Team(BaseModel):
    id: int
    name: str
    gender: Optional[TeamGender] = None
    competition: Optional[TeamCompetition] = None
    category: Optional[str] = None
    coach_id: Optional[int] = None

    class Config:
        from_attributes = True


class PlayerBase(BaseModel):
    first_name: str
    last_name: str
    position: Optional[str] = None
    number: Optional[int] = None
    team_id: int


class PlayerCreate(PlayerBase):
    pass


class Player(PlayerBase):
    id: int

    class Config:
        from_attributes = True


class TrainingSessionBase(BaseModel):
    date: date
    type: Optional[str] = None
    notes: Optional[str] = None
    team_id: int
    is_match: bool = False
    opponent_team_id: Optional[int] = None


class TrainingSessionCreate(TrainingSessionBase):
    pass


class TrainingSession(TrainingSessionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class StatRecordCreate(BaseModel):
    team_id: int
    player_id: Optional[int] = None
    training_session_id: Optional[int] = None
    metric_key: str
    value: float


StatCategory = Literal["attack", "reception", "serve", "block"]


class StatEntryCreate(BaseModel):
    """Structured volleyball stat entry (creates one or more metric rows)."""

    team_id: int
    player_id: int
    training_session_id: Optional[int] = None
    category: StatCategory

    attack_points: int = Field(0, ge=0, description="Direct points / kills")
    attack_faults: int = Field(0, ge=0)
    attack_rally_continues: int = Field(
        0, ge=0, description="Rally continues (in play, no point)"
    )

    reception_positives: int = Field(0, ge=0)
    reception_double_positives: int = Field(0, ge=0)
    reception_faults: int = Field(0, ge=0)

    serve_points: int = Field(0, ge=0, description="Aces / direct points")
    serve_faults: int = Field(0, ge=0)
    serve_rally_continues: int = Field(0, ge=0)

    blocks: int = Field(0, ge=0, description="Blocks (in play / scored)")
    blocks_out: int = Field(0, ge=0, description="Blocks out (ball out)")

    @model_validator(mode="after")
    def validate_category_has_counts(self) -> "StatEntryCreate":
        c = self.category
        if c == "attack":
            s = self.attack_points + self.attack_faults + self.attack_rally_continues
            if s < 1:
                raise ValueError(
                    "Enter at least one non-zero count for attack (points, faults, or rally continues)."
                )
        elif c == "reception":
            s = (
                self.reception_positives
                + self.reception_double_positives
                + self.reception_faults
            )
            if s < 1:
                raise ValueError(
                    "Enter at least one non-zero count for reception (positive, double positive, or fault)."
                )
        elif c == "serve":
            s = self.serve_points + self.serve_faults + self.serve_rally_continues
            if s < 1:
                raise ValueError(
                    "Enter at least one non-zero count for serve (points, faults, or rally continues)."
                )
        elif c == "block":
            if self.blocks + self.blocks_out < 1:
                raise ValueError(
                    "Enter at least one non-zero count for blocks or blocks out."
                )
        return self


class StatRecord(BaseModel):
    id: int
    team_id: int
    player_id: Optional[int] = None
    training_session_id: Optional[int] = None
    metric_key: str
    value: float
    recorded_by_user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class StatSummaryRow(BaseModel):
    metric_key: str
    total: float


StatChartScope = Literal["general", "session"]


class StatOutcomeTotals(BaseModel):
    """Points / faults / rally continues (used for attack and serve)."""

    points: float = 0
    faults: float = 0
    rally_continues: float = 0


class StatReceptionTotals(BaseModel):
    positive: float = 0
    double_positive: float = 0
    fault: float = 0


class StatBlockTotals(BaseModel):
    total: float = 0
    outs: float = 0


class PlayerStatBreakdown(BaseModel):
    player_id: int
    first_name: str
    last_name: str
    attack: StatOutcomeTotals
    serve: StatOutcomeTotals
    reception: StatReceptionTotals
    block: StatBlockTotals


class TeamPlayerStatsChartResponse(BaseModel):
    team_id: int
    training_session_id: Optional[int] = None
    scope: StatChartScope
    players: List[PlayerStatBreakdown]


class PlayerInsight(BaseModel):
    player_id: int
    first_name: str
    last_name: str
    team_id: int
    team_name: str
    strengths: List[str]
    vulnerabilities: List[str]
    cluster_id: int


class PlayerActionScore(BaseModel):
    player_id: int
    first_name: str
    last_name: str
    team_id: int
    team_name: str
    score: float


ScoutingAction = Literal["attack", "serve", "reception", "block"]


class ActionBestWorst(BaseModel):
    action: ScoutingAction
    best: Optional[PlayerActionScore] = None
    worst: Optional[PlayerActionScore] = None


class ModelRateStat(BaseModel):
    player_id: int
    first_name: str
    last_name: str
    team_id: int
    team_name: str
    attempts: int
    raw_rate: float
    adjusted_rate: float


class ModelActionInsight(BaseModel):
    action: ScoutingAction
    metric_name: str
    prior_strength: int
    category_baseline_rate: float
    min_attempts_high_volume: int
    best_adjusted: Optional[ModelRateStat] = None
    best_high_volume: Optional[ModelRateStat] = None
    best_raw_rate: Optional[ModelRateStat] = None
    notes: List[str] = []


class TeamScoutingInsightsResponse(BaseModel):
    team_id: int
    gender: Optional[str] = None
    competition: Optional[str] = None
    players: List[PlayerInsight]
    best_worst_by_action: List[ActionBestWorst] = []
    model_insights: List[ModelActionInsight] = []


MatchSide = Literal["home", "away"]


class MatchLineupBase(BaseModel):
    training_session_id: int
    side: MatchSide
    set_number: int = Field(1, ge=1, le=5)
    team_name: Optional[str] = None
    p1: Optional[int] = Field(None, ge=0)
    p2: Optional[int] = Field(None, ge=0)
    p3: Optional[int] = Field(None, ge=0)
    p4: Optional[int] = Field(None, ge=0)
    p5: Optional[int] = Field(None, ge=0)
    p6: Optional[int] = Field(None, ge=0)


class MatchLineupCreate(MatchLineupBase):
    pass


class MatchLineup(MatchLineupBase):
    id: int
    recorded_by_user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


MatchEventType = Literal[
    "attack_point",
    "attack_out",
    "block_point",
    "block_out",
    "serve_ace",
    "serve_fault",
    "opponent_error",
    "substitution",
]


class MatchPointEventBase(BaseModel):
    training_session_id: int
    set_number: int = Field(..., ge=1, le=5)
    rally_index: int = Field(..., ge=1)
    scoring_side: MatchSide
    event_type: MatchEventType
    player_number: Optional[int] = Field(None, ge=0)
    player_in_number: Optional[int] = Field(None, ge=0)
    player_out_number: Optional[int] = Field(None, ge=0)


class MatchPointEventCreate(MatchPointEventBase):
    @model_validator(mode="after")
    def _validate_substitution(self):
        if self.event_type == "substitution":
            if self.player_in_number is None or self.player_out_number is None:
                raise ValueError("substitution requires player_in_number and player_out_number")
        else:
            if self.player_in_number is not None or self.player_out_number is not None:
                raise ValueError("player_in_number/player_out_number only allowed for substitution")
        return self


class MatchPointEvent(MatchPointEventBase):
    id: int
    recorded_by_user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


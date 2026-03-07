from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel


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


class User(UserBase):
    id: int
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class TeamBase(BaseModel):
    name: str
    category: Optional[str] = None


class TeamCreate(TeamBase):
    pass


class Team(TeamBase):
    id: int

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


class TrainingSessionCreate(TrainingSessionBase):
    pass


class TrainingSession(TrainingSessionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


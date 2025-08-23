"""add wishlisted to cards

Revision ID: 1b493e9363ca
Revises: aea60cb44e19
Create Date: 2025-08-22 20:11:36.969988

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1b493e9363ca'
down_revision: Union[str, Sequence[str], None] = 'aea60cb44e19'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column(
        "cards",
        sa.Column("wishlisted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )

def downgrade():
    op.drop_column("cards", "wishlisted")
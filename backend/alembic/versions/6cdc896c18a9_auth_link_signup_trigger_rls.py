from alembic import op


# Alembic revision identifiers
revision = "6cdc896c18a9"
down_revision = None
branch_labels = None
depends_on = None


TABLES = [
    "users",
    "sessions",
    "session_documents",
    "participants",
    "snapshots",
    "chat_messages",
    "comments",
    "ai_messages",
]


def upgrade() -> None:
    # Link profiles to Supabase Auth users
    op.execute("""
        ALTER TABLE public.users
        ADD CONSTRAINT users_id_auth_fkey
        FOREIGN KEY (id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE
    """)

    # Create a profile row automatically when someone signs up
    op.execute("""
        CREATE FUNCTION public.handle_new_user()
        RETURNS trigger
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        BEGIN
            INSERT INTO public.users (id)
            VALUES (new.id);

            RETURN new;
        END
        $$
    """)

    op.execute("""
        CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_new_user()
    """)

    # Enable Row Level Security
    for table in TABLES:
        op.execute(
            f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY"
        )


def downgrade() -> None:
    # Disable Row Level Security
    for table in TABLES:
        op.execute(
            f"ALTER TABLE public.{table} DISABLE ROW LEVEL SECURITY"
        )

    op.execute(
        "DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users"
    )

    op.execute(
        "DROP FUNCTION IF EXISTS public.handle_new_user()"
    )

    op.execute(
        "ALTER TABLE public.users "
        "DROP CONSTRAINT IF EXISTS users_id_auth_fkey"
    )
# match/migrations/0011_court_slug.py
#
# Adds `slug` field to Court — a unique, human-readable identifier
# used for court-based scoreboard URLs: /screen/court/<slug>
#
# Auto-populates existing courts from: slugify(venue.name + "-" + court.name)
# e.g.  Venue "Khalifa SC" + Court "Court 1"  →  "khalifa-sc-court-1"

import django.utils.text
from django.db import migrations, models


def populate_slugs(apps, schema_editor):
    """Generate slugs for every existing court."""
    Court = apps.get_model("match", "Court")
    seen = {}
    for court in Court.objects.select_related("venue").order_by("id"):
        base = django.utils.text.slugify(f"{court.venue.name}-{court.name}")
        slug = base
        n = 1
        # Ensure uniqueness within this migration run
        while slug in seen:
            n += 1
            slug = f"{base}-{n}"
        seen[slug] = True
        court.slug = slug
        court.save(update_fields=["slug"])


class Migration(migrations.Migration):

    dependencies = [
        ("match", "0013_alter_match_assigned_umpire"),   # ← update if your latest is different
    ]

    operations = [
        # 1. Add nullable first so existing rows don't violate NOT NULL
        migrations.AddField(
            model_name="court",
            name="slug",
            field=models.SlugField(
                max_length=120,
                unique=False,   # enforced after population
                blank=True,
                default="",
                help_text="URL-friendly identifier — used for screen URLs (/screen/court/<slug>)",
            ),
        ),
        # 2. Populate slugs for existing rows
        migrations.RunPython(populate_slugs, migrations.RunPython.noop),
        # 3. Now enforce uniqueness + blank=False
        migrations.AlterField(
            model_name="court",
            name="slug",
            field=models.SlugField(
                max_length=120,
                unique=True,
                help_text="URL-friendly identifier — used for screen URLs (/screen/court/<slug>)",
            ),
        ),
    ]
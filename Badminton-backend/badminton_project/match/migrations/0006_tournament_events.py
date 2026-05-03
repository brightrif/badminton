# match/migrations/0005_tournament_event.py
#
# Adds TournamentEvent table and an optional event FK on Match.
# Depends on your latest migration — update the dependency name if needed.

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    # ── Update this to match your latest migration filename ───────────────────
    dependencies = [
        ('match', '0005_match_scoring_format'),
    ]

    operations = [
        # 1. Create TournamentEvent table
        migrations.CreateModel(
            name='TournamentEvent',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=120)),
                ('match_type', models.CharField(
                    choices=[
                        ('SINGLE', 'Singles'),
                        ('DOUBLES', 'Doubles'),
                        ('MIXED_DOUBLES', 'Mixed Doubles'),
                    ],
                    default='SINGLE',
                    max_length=20,
                )),
                ('format', models.CharField(
                    blank=True,
                    choices=[
                        ('KNOCKOUT', 'Knockout'),
                        ('ROUND_ROBIN', 'Round Robin'),
                        ('', 'Not set'),
                    ],
                    default='',
                    max_length=20,
                )),
                ('round_label', models.CharField(blank=True, default='', max_length=80)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('tournament', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='events',
                    to='match.tournament',
                )),
            ],
            options={
                'ordering': ['tournament', 'name'],
            },
        ),
        migrations.AddConstraint(
            model_name='tournamentevent',
            constraint=models.UniqueConstraint(
                fields=('tournament', 'name'),
                name='unique_event_name_per_tournament',
            ),
        ),

        # 2. Add nullable event FK to existing Match table
        migrations.AddField(
            model_name='match',
            name='event',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='matches',
                to='match.tournamentevent',
            ),
        ),
    ]
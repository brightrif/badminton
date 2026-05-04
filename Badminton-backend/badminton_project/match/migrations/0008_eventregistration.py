# match/migrations/0007_event_registration.py
#
# Adds EventRegistration table — links players to tournament events.
# Update the dependency to match your latest migration filename.

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        # ── Update this to your latest migration ──────────────────────────────
        ('match', '0007_remove_tournamentevent_unique_event_name_per_tournament_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='EventRegistration',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                ('registered_at', models.DateTimeField(auto_now_add=True)),
                ('event', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='registrations',
                    to='match.tournamentevent',
                )),
                ('player', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='event_registrations',
                    to='match.player',
                )),
            ],
            options={
                'ordering': ['event', 'player__name'],
            },
        ),
        migrations.AddConstraint(
            model_name='eventregistration',
            constraint=models.UniqueConstraint(
                fields=('event', 'player'),
                name='unique_player_per_event',
            ),
        ),
    ]
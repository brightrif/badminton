# match/migrations/0017_court_break_display_mode.py
#
# Adds break_display_mode to Court:
#   "sponsors" — show the 3-column sponsor showcase (default)
#   "video"    — play the uploaded ad video fullscreen

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('match', '0016_court_break_mode'),
    ]

    operations = [
        migrations.AddField(
            model_name='court',
            name='break_display_mode',
            field=models.CharField(
                max_length=10,
                choices=[('sponsors', 'Sponsors'), ('video', 'Video')],
                default='sponsors',
                help_text="What to show on the break screen: sponsor showcase or ad video.",
            ),
        ),
    ]
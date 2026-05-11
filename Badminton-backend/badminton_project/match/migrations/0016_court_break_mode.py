# match/migrations/0016_court_break_mode.py
#
# Adds two fields to Court:
#   break_mode  – boolean flag; True means the court screen is in break/sponsor mode
#   break_video – optional MP4 upload shown on the break screen

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        # Update this to your latest migration file name
        ('match', '0015_alter_court_slug_alter_match_event_doublescourtstate'),
    ]

    operations = [
        migrations.AddField(
            model_name='court',
            name='break_mode',
            field=models.BooleanField(
                default=False,
                help_text='When True the court screen switches to the break/sponsor showcase.',
            ),
        ),
        migrations.AddField(
            model_name='court',
            name='break_video',
            field=models.FileField(
                upload_to='break_videos/',
                blank=True,
                null=True,
                help_text='Optional MP4 ad video shown on the break screen (loops automatically).',
            ),
        ),
    ]
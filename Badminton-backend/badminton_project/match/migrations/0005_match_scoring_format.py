from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('match', '0004_alter_gamescore_game_number_alter_gamescore_match_and_more'),
    ]
    operations = [
        migrations.AddField(
            model_name='match',
            name='scoring_format',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('15_NO_SET',   '15 pts – no settings'),
                    ('15_WITH_SET', '15 pts – settings up to 21'),
                    ('21_NO_SET',   '21 pts – no settings'),
                    ('21_WITH_SET', '21 pts – settings up to 30'),
                ],
                default='21_WITH_SET',
                help_text='Scoring format for this match.',
            ),
        ),
    ]
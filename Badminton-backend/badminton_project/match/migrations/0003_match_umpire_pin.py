# Generated migration - add umpire_pin to Match model
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('match', '0002_remove_player_photo_url_remove_sponsor_logo_url_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='match',
            name='umpire_pin',
            field=models.CharField(
                max_length=4,
                default='0000',
                help_text='4-digit PIN for umpire access to this match'
            ),
        ),
    ]
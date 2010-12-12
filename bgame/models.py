from django.db import models

class Game(models.Model):
    started = models.DateTimeField(auto_now_add=True)
    ended = models.DateTimeField(null=True)
    name = models.CharField(max_length=40, unique=True)
    make_available = models.BooleanField(default=True)
    notes = models.TextField(blank=True, null=True)

    def __unicode__(self):
        return self.name

class Team(models.Model):
    ROLES = (
                        ('Factory','Factory'),
                        ('Distributor','Distributor'),
                        ('Wholesaler','Wholesaler'),
                        ('Retailer','Retailer')
                    )

    BUTTONS = (
                    ('none','none'),
                    ('start','start'),
                    ('step1','step1'),
                    ('step2','step2'),
                    ('ship','ship'),
                    ('step3','step3'),
                    ('order','order'),
                )

    game = models.ForeignKey(Game)
    role = models.CharField(max_length=12, choices=ROLES)
    last_completed_period = models.IntegerField(default=0)
    last_clicked_button = models.CharField(max_length=12, choices=BUTTONS, default="none") 

    session = models.CharField(max_length=40, blank=True, null=True)

    def save(self, *args, **kwargs):
        is_new = self.pk is None

        ret = super(self.__class__, self).save(*args, **kwargs)

        # only create period on initial game creation
        if is_new: 
            Period(team=self).save()

        return ret

    def __unicode__(self):
        return "%s playing in %s" % (self.role, self.game.name)

class Period(models.Model):
    created = models.DateTimeField(auto_now_add=True)

    team = models.ForeignKey(Team)
    number = models.IntegerField(default=0)

    inventory = models.IntegerField(default=12)
    backlog = models.IntegerField(default=0)

    demand = models.IntegerField(blank=True, null=True)
    order_1 = models.IntegerField(blank=True, null=True, default=4)
    order_2 = models.IntegerField(blank=True, null=True, default=4)

    # stores orders when team has not advanced order_1 => demand 
    # and order_2 => order_1
    order_stash = models.IntegerField(blank=True, null=True) 

    shipment_1 = models.IntegerField(blank=True, null=True, default=4)
    shipment_2 = models.IntegerField(blank=True, null=True, default=4)
    shipment_stash = models.IntegerField(blank=True, null=True)

    shipped = models.IntegerField(blank=True, null=True)
    order = models.IntegerField(blank=True, null=True, default=0)

    cost = models.DecimalField(max_digits=8, decimal_places=2, default='0.00')
    cumulative_cost = models.DecimalField(max_digits=8, decimal_places=2, default='0.00')

    def __unicode__(self):
        return "%d / %s / %s" % (self.number, self.team.role, self.team.game.name)

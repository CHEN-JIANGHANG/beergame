# Create your views here.
from datetime import datetime, timedelta
import json

from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext
from django.template.loader import render_to_string
from django.http import HttpResponse
from django.db.models import F
from django.contrib.auth.decorators import login_required
from django.contrib.auth import logout

from django.forms.models import modelformset_factory

from beergame.models import Game, Team, Period
from beergame.forms import GameForm
from jain import settings

class GameError(Exception):
    def __init__(self, error):
        self.error = error
    def __str__(self):
        return repr(self.error)
    

def _calculate_period_cost(inv, bl):
    """
    inv: integer value for inventory
    bl: integer value for backlog
    returns period cost calculation
    """
    return (inv * .5) + bl 

def _get_int(val):
    """
    val: string representation of a base 10 integer value
    return integer or GameError exception
    """
    # catch any ints and just return
    if type(val) == int:
        return val

    # attempt to convert to int
    try:
        return int(val, 10) 
    except TypeError, err:
        raise GameError('Error trying to parse string into integer: %s' % err)
    except Exception, err:
        raise GameError(err)

def _check_period_consistency(team_or_int, period):
    """
    team_or_int: team object or integer
    period: period value from client
    raises exception if there is inconsistency
    """

    if type(team_or_int) == int or\
        type(team_or_int) == long:
        db_period = team_or_int
    else:
        # grab the last period in the database
        team_period = Period.objects.filter(team=team_or_int).order_by('-number')[0]
        db_period = team_period.number

    # compare the database period to the one received from 
    # the client app
    client_period = _get_int(period)

    if db_period != client_period: 
        raise GameError('Period in database (%d) differs from the one sent from the web client (%d)' % (db_period, client_period))

def _can_ship(game, role, client_period):
    """
    game: the current game object
    role: text representation of team i.e. Retailer
    period: the integer value for current period (for error checking)
    returns boolean True = can ship, False = cannot ship
        or GameError if invalid state
    """
    this_team = get_object_or_404(Team, game=game, role=role)   

    # check consistency of this team
    _check_period_consistency(this_team, client_period)
    
    # verify that the last clicked button was step2 (the one before ship)
    if this_team.last_clicked_button != 'step2':
        raise GameError('Cannot ship.  Team has not clicked Step 2 button.'+\
                        'Last clicked button is %s' % (team.last_clicked_button))

    # retailers can always ship, since they are not actually shipping
    # to an object (customers don't exist in database)
    if role == 'Retailer':
        return True

    downstream_roles = {'Factory':'Distributor',
                        'Distributor':'Wholesaler',
                        'Wholesaler':'Retailer'}

    downstream_team = get_object_or_404(Team, game=game, 
                            role=downstream_roles[role])   


    period = Period.objects.filter(team=downstream_team).order_by('-number')[0]

    # Check consistency of downstream team
    #
    # If period is inconsistent then we cannot ship.
    # This will usually happen when another team has not
    # yet started the next period.
    #
    # For example: Factory just started on period 1, clicked the start
    # game button (created the period 1 object in db), clicked step 1 to
    # increment shipment, clicked step 2 to move the order, and now wants
    # to know if it can ship.  If Distributor has not started the period,
    # we cannot ship yet. 
    try:
        _check_period_consistency(period.number, client_period)
    except GameError, err:
        return False

    if period.shipment_2 == None:
        return True

    return False # cannot ship

def _can_order(game, role, client_period):
    """
    Determines whether a team can place an order with
    the upstream team.
    """
    client_period = _get_int(client_period)

    this_team = get_object_or_404(Team, game=game, role=role)   

    # check consistency of this team
    _check_period_consistency(this_team, client_period)

    # check that the last button pressed is correct for ordering
    if this_team.last_clicked_button != 'step3':
        raise GameError('Cannot order.  Team has not clicked Step 3 button.'+\
                        'Last clicked button is %s' % (team.last_clicked_button))

    # Factory is a shortcut since it orders from itself
    if role == 'Factory':
        return True


    upstream_roles = {'Distributor':'Factory',
                        'Wholesaler':'Distributor',
                        'Retailer':'Wholesaler'}

    upstream_team = get_object_or_404(Team, game=game, role=upstream_roles[role])   

    # The actual check to see if the other team has pressed
    # the step 2 button, so that another a place for another order
    # has been made.
    period = Period.objects.filter(team=upstream_team).order_by('-number')[0] 

    # We need to be on the same period to be able to order
    try:
        _check_period_consistency(period.number, client_period)
    except GameError, err:
        return False

    if period.order_2 == None:
        return True
    
    return False

def start(request):
    """
    Displays the homepage with possible games to join
    """
    # grab games started in the last hour
    hour_before = datetime.now() - timedelta(hours=72) 
    games = Game.objects.filter(make_available=True)

    return render_to_response('start.html', 
                                {
                                    'games': games,
                                },
                                context_instance=RequestContext(request))
@login_required
def create_game(request):
    """
    Creates a new game
    Do not create games through the database
    because teams will not get created.
    """
    # TODO create teams on creation of game (do in database layer)
    game = Game()
    game_form = GameForm(request.POST, instance=game)

    if game_form.is_valid():
        game_form.save()
    else:
        error = "Name of game already exists in the database.  Please go back and try another name."
        return render_to_response('create_game.html', {'error': error})

    # create teams
    for role in Team.ROLE_CHOICES:
        Team(game=game, role=role[0]).save()
    
    return render_to_response('create_game.html', {'game': game})

def join_game(request, game):
    """
    After a user has selected a game to join, this displays
    the possible roles they can join as: Factory, Distributor, 
    Wholesaler, Retailer
    """
    game = get_object_or_404(Game, pk=game)

    roles = Team.ROLE_CHOICES 
    return render_to_response('join_game.html', {
                                                    'game':game,
                                                    'roles':roles
                                                },
                                                context_instance=RequestContext(request)) 

def game(request, game, role):
    """
    Main game.  This is where players will
    actual play the game and interact with each other.
    """
    game = get_object_or_404(Game, pk=game)

    # get team
    # team = Team.objects.filter(game=game).filter(role=role)
    team = get_object_or_404(Team, game=game, role=role)

    try:
        period = Period.objects.filter(team=team).order_by('-number')[0]

    # should never happen
    # TODO throw an error
    except Period.DoesNotExist:
        # new game at period 0
        period = 0

    if team.last_clicked_button in ['step3', 'order', 'none']:
        period_range = 0 
    else:
        period_range = 1 

    # if second period, last completed would be 1 so [0:1] which returns only second period
    all_periods = Period.objects.filter(team=team).exclude(number=0).order_by('-number')[period_range:]

    return render_to_response('game.html', {
                                            'game': game,
                                            'role': role,
                                            'period': period,
                                            'all_periods':all_periods,
                                            'display_orders':settings.DISPLAY_ORDERS,
                                            },
                                            context_instance=RequestContext(request))

def _get_period(game, role, period):
    #game = get_object_or_404(Game, pk=game)
    team = get_object_or_404(Team, game=game, role=role)
    return Period.objects.filter(team=team).get(number=int(period))

def _set_period_value(game, role, period, field, val):
    period = _get_period(game, role, period)
    setattr(period, field, val)
    period.save()

def _set_last_clicked(game, role, value):
    team = get_object_or_404(Team, game=game, role=role)
    def in_tuple(val, tuple):
        for tup in tuple:
            if val in tup:
                return True
        return False

    if in_tuple(value, Team.BUTTONS):
        team.last_clicked_button = value
        team.save()
        return True
    return False

def _get_shipment2_html(game, role, data):
    period = _get_period(game, role, data['period']) 
    return render_to_string('shipment_2.html', {'period': period}) 

def _get_order2_html(game, role, data):
    period = _get_period(game, role, data['period']) 
    return render_to_string('order_2.html', {'period': period}) 

def ajax(request, game, role):
    # shared data between all ajax calls
    game = get_object_or_404(Game, pk=game)
    data = request.REQUEST.copy()

    #
    # GET
    #
    # Retrieves values from the database
    # * shipment_2
    #   * gets the value of shipment_2
    #
    if data.has_key('period') and data.has_key('get'):
        # XXX this api functionality could be used for 
        # players to cheat.  FIX: limit what things can be grabbed 

        if data['get'] == 'shipment_2':
            period = _get_period(game, role, data['period']) 
            value = getattr(period, data['get'])

            tmpl = _get_shipment2_html(game, role, data);
            
            team = get_object_or_404(Team, game=game, role=role)

            return HttpResponse(json.dumps({
                                            'html': tmpl, 
                                            data['get']: value,
                                            'last_clicked': team.last_clicked_button,
                                           }),
                                mimetype='text/javascript')
        
        period = _get_period(game, role, data['period']) 

        try:
            value = getattr(period, data['get'])
        except KeyError, ex:
            return HttpResponse(json.dumps({'error': 'attribute does not exist'}),
                        mimetype='text/javascript')
        return HttpResponse(json.dumps({data['get']:value, 'display_orders':settings.DISPLAY_ORDERS}),
                mimetype='text/javascript')


    # returns the latest period number
    elif data.has_key('current'):
        team = get_object_or_404(Team, game=game, role=role)
        latest_period = Period.objects.filter(team=team).order_by('-number')[0]
        if data['current'] == 'period':
            return HttpResponse(json.dumps({'period':latest_period.number}), 
                mimetype='text/javascript')
        if data['current'] == 'inventory':
            return HttpResponse(json.dumps({'inventory':latest_period.inventory}), 
                mimetype='text/javascript')

    #
    # CHECKS
    #
    # Section for performing various checks
    # Checks usually occur when we are waiting for state 
    # to change in order to do something
    #
    #   * teams_ready: waiting for other teams to finish period
    #   so we can start the next one
    #
    #   * can_ship: waiting for downstream team to increment the incoming
    #   shipments by pushing Step 1 button, clearing Shipment 2 slot
    #
    elif data.has_key('period') and data.has_key('check'):
        # setting period as we'll use this in various spots
        # for consistency checks
        client_period = _get_int(data['period'])

        #
        # CHECK -- teams_ready
        # Returns whether the all teams are finished with the current period.
        # If the teams are not all ready, it returns the roles of the teams that
        # are not ready.
        #
        if data['check'] == 'teams_ready':
            teams = Team.objects.filter(game=game)
            not_ready = []
            ready = []
            for check_team in teams:
                if check_team.role == role:
                    continue
                # removed print statements mod_wsgi restricted sys.stdout access
                # game just started
                # or
                # teams have all clicked order during the current period
                if int(data['period']) == 0:
                    #print '%s ready because period is zero' % (check_team.role)
                    ready.append(check_team.role)
                elif (check_team.last_completed_period == (int(data['period']) - 1) and \
                    check_team.last_clicked_button == 'order'):
                    #print '%s ready because last_clicked was order and last finished \
                        period was %s' % (check_team.role, data['period'])
                    ready.append(check_team.role)
                elif (check_team.last_completed_period == int(data['period'])):
                    #print '%s was ready because last completed the current period' % (check_team.role)
                    ready.append(check_team.role)
                else:
                    #print '%s was not ready: last_clicked: %s and last_completed: %s and cur period: %s' \
                            % (check_team.role, check_team.last_clicked_button, 
                            check_team.last_completed_period, data['period'])
                    not_ready.append(check_team.role)

            if len(not_ready) > 0:
                return HttpResponse(json.dumps( {
                                                'teams_ready': False,
                                                'waiting_for': not_ready,
                                                'ready': ready
                                                }),
                            mimetype='text/javascript')
            return HttpResponse(json.dumps({'teams_ready':True, 'ready':ready}),
                        mimetype='text/javascript')

        elif data['check'] == 'can_ship':
            can_ship = _can_ship(game, role, client_period)
            return HttpResponse(json.dumps({'can_ship':can_ship}),
                    mimetype='text/javascript')

        #
        # CHECK -- can_order
        # returns http response whether the team
        # can submit an order
        #
        elif data['check'] == 'can_order':
            can_order = _can_order(game, role, data['period'])
            return HttpResponse(json.dumps({'can_order': can_order}),
                        mimetype='text/javascript')

        # finally throw an error
        # TODO describe error condition better
        return HttpResponse(json.dumps({'error': 'check argument not valid'}),
                    mimetype='text/javascript')

    elif data.has_key('query'):
        if data['query'] == 'last_clicked':
            team = get_object_or_404(Team, game=game, role=role) 
            return HttpResponse(json.dumps({'last_clicked':team.last_clicked_button}),
                     mimetype='text/javascript')

        return HttpResponse(json.dumps({'error': 'query argument not valid'}),
                    mimetype='text/javascript')

    elif data.has_key('set') and data.has_key('value'):
        if data['set'] == 'last_clicked':
            if _set_last_clicked(game, role, data['value']):
                return HttpResponse(json.dumps({'success':'set last clicked button'}),
                        mimetype='text/javascript')
            else:
                return HttpResponse(json.dumps({'error':'button name does not exist'}),
                        mimetype='text/javascript')
        return HttpResponse(json.dumps({'error':'set argument does not exist'}),
                    mimetype='text/javascript')

    # @step = start
    # @period = period for the last completed round
    elif data.has_key('step') and data.has_key('period'): 
        team = get_object_or_404(Team, game=game, role=role)
        # start
        if data['step'] == 'start':

            # When teams first start, it doesn't make sense to increment the 
            # last completed period.
            # At period 0, we don't want to increment yet
            # At period the end of period 1, we'll increment to 1 as 
            # they are starting period 2
            if team.last_completed_period != 0 or team.last_clicked_button != 'none':
                team.last_completed_period += 1 
                team.save()
            else:
                #print 'not increment last_completed_period -- last_completed_period: %d -- last_clicked_button %s' % (team.last_completed_period, team.last_clicked_button)

            per = int(data['period'])
            latest_period = Period.objects.filter(team=team).order_by('-number')[0]

            # check for consistency
            if latest_period.number != per:
                return HttpResponse(json.dumps({'error':'periods are incorrect'}),
                        mimetype='text/javascript')

            next_per = per+1 

            period = Period(team=team, number=next_per,
                        inventory=latest_period.inventory, backlog=latest_period.backlog, 
                        order_1=latest_period.order_1, order_2=latest_period.order_2, 
                        shipment_1=latest_period.shipment_1, shipment_2=latest_period.shipment_2, 
                        cumulative_cost=latest_period.cumulative_cost)
            period.save()

            _set_last_clicked(game, role, "start")
            
            return HttpResponse(json.dumps({'success':'completed start step'}),
                        mimetype='text/javascript')

        # step 1
        if data['step'] == 'step1':
            #_set_period_attr(game, role, int(data['period']), 
            #                    'shipment_1', int(data['shipment1'])) 
            period = Period.objects.filter(team=team).order_by('-number')[0]

            # check for consistency
            if period.number != int(data['period']):
                return HttpResponse(json.dumps({'error':'periods are incorrect'}),
                        mimetype='text/javascript')

            period.inventory = period.inventory + period.shipment_1
            period.shipment_1 = period.shipment_2
            period.shipment_2 = None

            period.save()

            _set_last_clicked(game, role, "step1")

            tmpl = _get_shipment2_html(game, role, data);

            return HttpResponse(json.dumps({
                                            'success': 'completed step 1',
                                            'html': tmpl
                                            }),
                    mimetype='text/javascript')

        elif data['step'] == 'step2':
            period = Period.objects.filter(team=team).order_by('-number')[0]

            # check for consistency
            if period.number != int(data['period']):
                return HttpResponse(json.dumps({'error':'periods are incorrect'}),
                        mimetype='text/javascript')

            period.demand = period.order_1
            period.order_1 = period.order_2
            period.order_2 = None

            if role == 'Retailer':
                per_num = int(data['period'])
                if per_num < 3:
                    period.order_2 = 4 
                else:
                    period.order_2 = 8

            period.save()

            tmpl = _get_order2_html(game, role, data)

            _set_last_clicked(game, role, "step2")

            return HttpResponse(json.dumps({
                                            'step2':period.demand,
                                            'html': tmpl
                                            }),
                    mimetype='text/javascript')

        elif data['step'] == 'step3':
            team = Team.objects.filter(game=game).filter(role=role)
            all_periods = Period.objects.filter(team=team).exclude(number=0).order_by('-number')

            _set_last_clicked(game, role, "step3")
            return render_to_response('period_table.html', {'all_periods':all_periods}) 
             
    #
    # Ship button is pressed and we are trying to ship downstream
    # Factory => Distributor
    # Distributor => Wholesaler
    # Wholesaler => Factory
    # Factory => Customer
    #   * in the program, there is no customer object so it basically just disappears
    #
    elif data.has_key('shipment') and data.has_key('period'):
        # TODO test whether can_ship is true

        shipment = int(data['shipment'])

        downstream_roles = {'Factory':'Distributor',
                            'Distributor':'Wholesaler',
                            'Wholesaler':'Retailer'}

        team = get_object_or_404(Team, game=game, role=role) 
        period = Period.objects.filter(team=team).order_by('-number')[0]

        # check for consistency
        if period.number != int(data['period']):
            return HttpResponse(json.dumps({'error':'periods are incorrect'}),
                    mimetype='text/javascript')

        if role != 'Retailer':
            downstream = get_object_or_404(Team, game=game, role=downstream_roles[role])   
            #downstream_period = Period.objects.filter(team=downstream).order_by('-number')[0]
            try:
                downstream_period = Period.objects.filter(team=downstream).filter(number=int(data['period']))[0]
            except KeyError:
                return HttpResponse(json.dumps({'error':'periods are incorrect'}),
                    mimetype='text/javascript')
                
            downstream_period.shipment_2 = shipment 
            downstream_period.save()

        period.shipped = shipment 

        # reduce inventory
        if period.inventory >= shipment:
            period.inventory = period.inventory - shipment 
        else:
            return HttpResponse(json.dumps({'error':'cannot ship more than inventory amount'}),
                    mimetype='text/javascript')

        from decimal import Decimal
        # handle backlog
        if shipment < period.demand:
            backlog = period.demand - shipment
            period.backlog = period.backlog + backlog
            #period.cost = period.cost + Decimal(str(period.backlog)) 

        # reduce backlog if more sent
        if shipment > period.demand:
            if period.backlog != 0:
                period.backlog = period.backlog - (shipment - period.demand)

        # inventory and backlog costs
        period.cost = period.cost + Decimal(str(period.inventory * .5)) + Decimal(str(period.backlog))

        # total costs
        period.cumulative_cost = period.cumulative_cost + period.cost

        period.save()

        _set_last_clicked(game, role, "ship")

        return HttpResponse(json.dumps({'success':'shipped %d' % shipment}),
                mimetype='text/javascript')

    elif data.has_key('order') and data.has_key('period'):
        order = int(data['order'])
        team = get_object_or_404(Team, game=game, role=role)

        period = Period.objects.filter(team=team).order_by('-number')[0] 
        period.order = order 
        period.save()

        upstream_roles = {'Distributor':'Factory',
                            'Wholesaler':'Distributor',
                            'Retailer':'Wholesaler'}

        if role == 'Factory':
            period.shipment_2 = order
            period.save()

        else: 
            upstream = get_object_or_404(Team, game=game, role=upstream_roles[role])
            upstream_period = Period.objects.filter(team=upstream).order_by('-number')[0]
            upstream_period.order_2 = order
            upstream_period.save()

        _set_last_clicked(game, role, 'order')

        return HttpResponse(json.dumps({'success':'ordered %d' % order}),
                    mimetype='text/javascript')

    elif data.has_key('html'):
        if data['html'] == 'period_table':
            team = Team.objects.filter(game=game).filter(role=role)
            all_periods = Period.objects.filter(team=team).exclude(number=0).order_by('-number')
            return render_to_response('period_table.html', {'all_periods':all_periods}) 

    else:
        return HttpResponse(json.dumps({'error': 'missing required arguments'}),
                    mimetype='text/javascript')

def logout_view(request):
    logout(request)
    return render_to_response('logout.html', {})

# admin views
@login_required
def cp(request):
    games = Game.objects.all()
        
    return render_to_response('cp.html',    {
                                                'games': games,
                                                'game_form': GameForm(),
                                                'cp': True,
                                            },
                                            context_instance=RequestContext(request))
@login_required
def get_chart(request):
    data = request.REQUEST.copy()
    if data.has_key('id'):
        game = get_object_or_404(Game, pk=data['id'])
        teams = Team.objects.filter(game=game)
       
        periods = {}
        for team in teams:
            periods[team.role] = Period.objects.filter(team=team).order_by('number')

        orders = {}
        max_order = 0
        for role in periods:
            orders[role] = '' 
            for period in periods[role]:
                if period.order is not None:
                    if period.order > max_order:
                        max_order = period.order
                    orders[role] += str(period.order)+','
            orders[role] = orders[role][0:-1]

        url = 'http://chart.apis.google.com/chart?'+\
                '&cht=ls'+\
                '&chs=500x325'+\
                '&chd=t:%s|%s|%s|%s' % (orders['Factory'], orders['Distributor'], 
                                        orders['Wholesaler'], orders['Retailer'])+\
                '&chds=0,%d' % max_order+\
                '&chco=ff0000,336699,cccccc,000000'+\
                '&chls=2'+\
                '&chtt=Beer+Game+Results+for+%s' % game.name+\
                '&chts=000000,20'+\
                '&chdl=Factory|Distributor|Wholesaler|Retailer'+\
                '&chxt=x,y'+\
                '&chxr=0,0,%d,1|1,0,%d' % (teams.get(role='Factory').last_completed_period,
                                            max_order)+\
                '&chxl=3:|Period'

        return HttpResponse(json.dumps({'chart': url,'id':data['id'], 'name': game.name}),
                    mimetype='text/javascript')
        
    else:
        return HttpResponse(json.dumps({'error': 'missing required arguments'}),
                    mimetype='text/javascript')
        
@login_required
def output_csv(request):
    import csv
    from datetime import datetime
    response = HttpResponse(mimetype='text/csv')
    response['Content-Disposition'] = 'attachment; filename=beergame.csv'

    data = request.REQUEST.copy()

    # start_time = datetime.strptime("%s %s %s %s %s %s" % (data['month'], data['day'],
    #                 data['year'], data['hour'], data['minute'], data['ampm']),
    #                                 "%m %d %Y %I %M %p")
    
    start_time = datetime.strptime(data['datetime'], "%m/%d/%Y %I:%M %p")


    writer = csv.writer(response)
    writer.writerow(['Index','Game','Role','Number','Inventory','Backlog',
        'Demand','Order1','Order2','Shipment1','Shipment2','Shipped','Cost',
        'Cumulative Cost','Order'])

    games = Game.objects.filter(date_started__gte=start_time)

    for game in games:
        teams = Team.objects.filter(game=game)
        
        for team in teams:
            periods = Period.objects.filter(team=team).order_by('number')
            
            idx = 0
            for period in periods:
                idx += 1
                vals = [period.pk, period.team.game, period.team.role, period.number, 
                period.inventory, period.backlog,period.demand,period.order_1, 
                period.order_2, period.shipment_1, period.shipment_2, period.shipped, 
                period.cost, period.cumulative_cost, period.order]

                writer.writerow(vals)

                if idx == 40:
                    break
            
            while idx < 40:
                idx += 1
                writer.writerow([])
    
    return response

def js_test(request):
    # the game and role is loaded from the test fixtures
    game = Game.objects.get(id=1) 
    team = get_object_or_404(Team, game=game, role='Factory')
    role = 'Factory'
    period = Period.objects.filter(team=team).order_by('-number')[0]

    if team.last_clicked_button in ['step3', 'order', 'none']:
        period_range = 0 
    else:
        period_range = 1 

    all_periods = Period.objects.filter(team=team).exclude(number=0).order_by('-number')[period_range:]

    return render_to_response('jstest.html', {
                                                'game': game,
                                                'role': role,
                                                'period': period,
                                                'all_periods':all_periods,
                                                'display_orders':settings.DISPLAY_ORDERS,
                                            },
                                            context_instance=RequestContext(request))

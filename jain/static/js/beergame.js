/* VISUAL ELEMENTS */

$('.step_wrapper').corner("10px"); // for dark gray rounded corners
$('.step').corner("8px"); // for light gray rounded corners 
$('.lead_tile').corner(); // for orange rounded corners

/* END VISUAL ELEMENTS */

/* CONSTANTS */
CHECK_INTERVAL = 4000; // milliseconds to hit server for updates
FADE_SPEED = 700; // milliseconds for fade
DEBUG = true;
/* END CONSTANTS */

/* CONFIGURATION */
// if AJAX_URL is already set, we'll use that
// this is used for testing page
if (typeof(window.AJAX_URL) == "undefined") {
    AJAX_URL = 'ajax/'; 
}

// configure AJAX 
$.ajaxSetup({
    url: AJAX_URL, 
    cache: false,
    type: 'POST',
    dataType: 'json'
});

// configure jGrowl
$.jGrowl.defaults.position = "bottom-right";

/* END CONFIGURATION */

/*
 * outputs a message using jGrowl
 */
function display_message(msg) {
    $.jGrowl(msg);
}

/*
 * updates the status message at top of screen
 */
function update_status(message) {
    $('#status-message').text(message);
}

function log_debug(msg) {
    if (DEBUG) {
        console.log(msg);
    }
}

function log_error(msg) {
    $('#errors ul').prepend('<li>'+msg+'</li>');
}

function Game() {
    // ATTRIBUTES 
    this.period = undefined;
    this.inventory = undefined;
    this.backlog = undefined;
    this.last_clicked = undefined;

    // METHODS
    // get the current inventory 
    this.get_inventory = function() {
        if (this.inventory !== undefined) {
            return this.inventory;
        }
        else {
            // try to get inventory from
            // the HTML
            var inv_elm = $('#inv_amt');
            var inv_num = parseInt(inv_elm.text());

            if (!isNaN(inv_num)) {
                this.inventory = inv_num;
                return this.inventory; 
            }
            else {
                // an error?
                // can't get inventory from HTML
                // get inventory from server
                log_error('Inventory was not an integer');
                this._reset_inventory();
                return this.inventory;
            }
        }
    };

    this.set_inventory = function(val) {
        this.inventory = val; 
        var inv_elm = $('#inv_amt');
        inv_elm.text(val);
    };

    // grabs canonical inventory from server
    this._reset_inventory = function() {
        var self = this;
        // get period from server
        $.ajax({
            async: false,
            data: {current: 'inventory'},
            success: function(data, textStatus) {
                if ('error' in data) {
                    log_error(data['error']);
                }
                if ('inventory' in data) {
                    self.inventory = parseInt(data['inventory']);
                }
            }
        });
    };

    this.get_period = function() {
        var self = this;
        if (this.period !== undefined) {
            return this.period;
        }
        else {
            // attempt to get period from HTML
            var period_text = $('#period_num').text();
            var html_period = parseInt(period_text, 10);
            if (!isNaN(html_period)) {
                this.period = html_period;
                return html_period;
            }
            else if (period_text.indexOf('Just started') >= 0) {
                this.period = 0;
                return 0;
            }
            // can't get from HTML, get from server
            else {
                log_error('unable to get period from HTML');
                this._reset_period();
                return this.period;
            }
        }
    };

    this.set_period = function(period) {
        if (period === undefined) {
            period = this.period;
        }
        var per_elm = $('#period_num');
        per_elm.text(period);
    };

    this.increment_period = function() {
        this.period++;
        this.set_period();
    };

    // grabs canonical period from server
    this._reset_period = function() {
        var self = this;
        // get period from server
        $.ajax({
            async: false,
            data: {current: 'period'},
            success: function(data, textStatus) {
                if ('error' in data) {
                    log_error(data['error']);
                }
                if ('period' in data) {
                    self.period = parseInt(data['period']);
                }
            }
        });
    };

    // incoming shipments 
    this.get_shipment1 = function() {
        return parseInt($('#ship1_amt').text()); 
    };

    this.set_shipment1 = function(val) {
        $('#ship1_amt').text(val);
    };

    // incoming orders
    this.get_order = function() {
        var order = parseInt($('#order_amt').text()); 
        if (isNaN(order)) {
            log_error('order was not a number');
            return false;
        }
        return order;
    };

    this.set_order = function(val) {
        $('#order_amt').text(val);
    };

    // outgoing shipment 
    this.get_amt_to_ship = function() {
        return $('#amt_to_ship').val();
    };

    this.set_amt_to_ship = function(val, select) {
        var shipment_input = $('#amt_to_ship')
        shipment_input.val(val);

        if (select) {
            shipment_input.select(); 
        }
    };
    
    // outgoing order
    this.get_amt_to_order = function() {
        return parseInt($('#amt_to_order').val());
    };

    this.set_amt_to_order = function(val) {
        $('#amt_to_order').val(val);
    };


    this.get_shipment_recommendation = function(backlog, inventory, order) {
        log_debug('backlog: '+backlog);
        log_debug('inventory: '+inventory);
        log_debug('order: '+order);
        // backlog
        if (backlog > 0) {
            // can deliver both backlog and order
            if (inventory >= (backlog + order)) {
                return backlog + order;
            }
            // can't deliver full backlog and order
            else {
                return inventory; 
            }
        }
        // no backlog
        else {
            // order is more than inventory
            if (order > inventory) {
                return inventory; 
            }
            // order is less than inventory
            else {
                return order;
            }
        }
    };

    this.set_shipment_recommendation = function() {
        var amount = this.get_shipment_recommendation(this.get_backlog(),
                                                    this.get_inventory(),
                                                    this.get_order());
        this.set_amt_to_ship(amount, true);
    };

    this.get_backlog = function() {
        if (this.backlog !== undefined) {
            return this.backlog;
        }
        else {
            this._reset_backlog();
            return this.backlog;
        }
    };

    this._reset_backlog = function() {
        var self = this;
        $.ajax({
            async: false,
            data: {
                    get: 'backlog',
                    period: self.get_period()
            }, 
            success: function(data, textStatus) {
                if ('error' in data) {
                    log_error(data['error']);
                }
                if ('backlog' in data) {
                    self.backlog = parseInt(data['backlog']);
                }

            }
        });
    };

    this.listen_for_can_ship = function() {
        var self = this;
        function check_can_ship() {
            $.ajax({
                data: {
                        check: 'can_ship',
                        period: self.get_period()
                },
                success: function(data, textStatus) {
                    if ('can_ship' in data) {
                        if (data['can_ship']) {
                            $('#ship_btn').attr('disabled',false); 
                            $('#ship_btn').val('Ship'); 
                            $('#step2_btn').stopTime();
                            display_message('You can now ship');
                        }
                    }
                    else if ('error' in data) {
                        log_error(data['error']);
                    }
                    else {
                        log_error('listen for can ship returned invalid data');
                    }
                }
            });
        }
        check_can_ship();
        $('#step2_btn').everyTime(CHECK_INTERVAL, function() {
            check_can_ship();
        });
    };

    this.listen_for_can_order = function() {
        var self = this;
        function check_can_order() {
            $.ajax({
                    data: {
                            check: 'can_order',
                            period: self.get_period()
                    },
                    success: function(data, textStatus) {
                        if ('error' in data) {
                            log_error(data['error']);
                        }
                        else {
                            if ('can_order' in data) {
                                if (data['can_order']) {
                                    $('#order_btn').attr('disabled',false); 
                                    $('#order_btn').val('Order'); 
                                    $('#step3_btn').stopTime();
                                    display_message('You can now order');
                                }
                            }
                        }
                    }
            });
        }
        check_can_order();
        $('#step3_btn').everyTime(CHECK_INTERVAL, function() {
            check_can_order();
        });
    };

    this.wait_for_teams = function() {
        var self = this;
        var next_per_btn = $('#next_period_btn');

        if (self.get_period() == 0) {
            next_per_btn.val('Start game');
            next_per_btn.attr('disabled',false);
        }
        else {
            // wait for other teams to finish
            next_per_btn.val('Waiting for Other firms to Order');
            function check_for_teams() {
                 $.ajax({
                        data: {
                                check: 'teams_ready',
                                period: self.get_period()
                        },
                        success: function(data, textStatus) {
                            if ('teams_ready' in data) {
                                if (data['teams_ready']) {
                                    var per_btn = $('#next_period_btn');
                                    per_btn.attr('disabled', false);
                                    per_btn.val('Start next period');
                                    $('#order_btn').stopTime();
                                }
                                else if ('waiting_for' in data) {
                                    for (var team in data['waiting_for']) {
                                        display_message('Waiting for '+data['waiting_for'][team]);
                                    }
                                }
                            }
                            else if ('error' in data) {
                                log_error(data['error']);
                            }
                        }
                });

            }
            check_for_teams();
            $('#order_btn').everyTime(CHECK_INTERVAL, function() {
                check_for_teams();
            });
        }
    };

    this.set_buttons = function() {
        var self = this;
        if ($('#next_period_btn').get().length == 1) {
            $.ajax({
                    data:   { 
                                query: 'last_clicked'
                            },
                    success: function(data, textStatus) {
                        var btns = {
                                        start:  'next_period_btn',
                                        step1:  'step1_btn',
                                        step2:  'step2_btn',
                                        ship:   'ship_btn',
                                        step3:  'step3_btn',
                                        order:  'order_btn'
                                    };
                        var last_clicked = data['last_clicked'];
                        var start_index = 0;
                        if (last_clicked == 'none') {
                            for (var btn in btns) {
                                $('#'+btns[btn]).attr('disabled',true);
                            }
                            self.wait_for_teams();
                        }
                        else if (last_clicked in btns) {
                            var disable = true;
                            for (var btn in btns) {
                                $('#'+btns[btn]).attr('disabled',disable);
                                if (!disable) { disable = true; }
                                if (btn == last_clicked) { disable = false; }
                            }
                            if (!$('#ship_btn').attr('disabled')) {
                                $('#ship_btn').attr('disabled',true); 
                                $('#ship_btn').val('waiting...'); 

                                self.set_shipment_recommendation();

                                self.listen_for_can_ship();
                            }
                            else if (!$('#order_btn').attr('disabled')) {
                                $('#order_btn').attr('disabled', true); 
                                $('#order_btn').val('waiting...'); 
                                
                                self.listen_for_can_order();
                            }
                        }
                        else {
                            log_error('last clicked returned an invalid button: '+last_clicked);
                        }
                    }
            });
        }
    };

    this.listen_for_shipment = function() {
        var self = this;
        function check_shipment() {
            $.ajax({
                    data: {
                        get: 'shipment_2',
                        period: self.get_period()
                    },
                    success: function(data, textStatus) {
                        if ('shipment_2' in data && data['shipment_2'] != null) {
                            $('#step1').stopTime();
                            $('#shipment2').remove();
                            $('#shipment1').after('<div id="shipment2" class="lead_tile">' + 
                                '<h4>Shipment #2</h4><p id="ship2_amt">'+data['shipment_2']+'</p></div>');

                            $('#shipment2').corner();
                           
                            // if shipment arrives after step3, table will
                            // be updated
                            $.ajax({
                                    data: {
                                        query: 'last_clicked',
                                        period: self.get_period()
                                    },
                                    success: function(data, textStatus) {
                                        if ('last_clicked' in data) {
                                            var last_clicked = data['last_clicked'];
                                            if (last_clicked in ['step3','order','none']) {
                                                self.reload_period_table();
                                            }
                                        }
                                        else if ('error' in data) {
                                            log_error(data['error']);
                                        }
                                    }
                            });
                        }
                        else if ('error' in data) {
                            log_error(data['error']);
                        }
                    }        
            });
        }
        check_shipment();
        // starts listening for next shipment
        $('#step1').everyTime(CHECK_INTERVAL, function() {
            check_shipment();
        });
    };

    this.listen_for_order = function() {
        var self = this;
        function check_order() {
            $.ajax({
                    data: {
                        period: self.get_period(),
                        get: 'order_2'
                    },
                    success: function(data, textStatus) {
                        if ('order_2' in data && data['order_2'] != null) {
                            $('#step2').stopTime();
                            if ('display_orders' in data) {
                                if (data['display_orders']) {
                                    $('#order2_amt').text(data['order_2']);
                                }
                            }
                            $('#order2_amt').text('');
                        }
                        else if ('error' in data) {
                            log_error(data['error']);
                        }
                    }
            });
        }
        check_order();
        $('#step2').everyTime(CHECK_INTERVAL,function() {
            check_order();
        });
    };

    this.set_timers = function() {
        var self = this;
        $.ajax({
                data: {
                       query: 'last_clicked',
                       period: self.get_period()
                },
                success: function(data, textStatus) {
                    if ('last_clicked' in data) {
                        var last_clicked = data['last_clicked'];

                        if (last_clicked == 'step1' || last_clicked == 'step2' || 
                            last_clicked == 'ship' || last_clicked == 'step3' 
                            || last_clicked == 'order') {

                            self.listen_for_shipment();    

                            if (last_clicked != 'step1') {
                                self.listen_for_order();
                            }
                        }
                    }
                }
        });
    };

    this.reload_period_table = function() {
        var self = this;
        $.ajax({
                dataType: 'html',
                data: {
                        html: 'period_table',
                        period: this.get_period()
                },
                success: function(result, textStat) {
                    $('#period_table').html(result);
                }
        });
    };

    this.next_period_btn_click = function() {
        var self = this;
        $.post('ajax/',
                {
                    step: 'start',
                    period: self.get_period()
                }, function(data, textStatus) {
                    if ('error' in data) {
                        log_error(data['error']);
                    }
                }, 'json');

        // increment the period
        cur_period = this.get_period(); 

        this.increment_period();

        // remove shipped amount
        $('#amt_to_ship').val('');

        // remove ordered amount
        $('#amt_to_order').val('');

    };

    this.step1_btn_click =  function() {
        var self = this;
            $.ajax({
                data: {
                    step: 'step1',
                    period: self.get_period()
                },
                success: function(data, textStatus) {
                    if ('error' in data) {
                        log_error(data['error']);
                    }
                    console.log('completed step1'); 
                }
            });
            var ship_div = $('#shipment1');

            // remove shipment 1 div
            ship_div.fadeOut(FADE_SPEED, function() { 
                // increment the inventory
                self.set_inventory(self.get_inventory()+self.get_shipment1());

                ship_div.remove(); 

                // change ship2 to ship1
                var ship2_div = $('#shipment2');
                ship2_div.attr('id','shipment1');
                $('#ship2_amt').attr('id','ship1_amt');
                $('#shipment1 > h4').text('Shipment1'); 
                $('#shipment1').after('<div id="shipment2" class="lead_tile">' + 
                    '<h4>Shipment2</h4><p id="ship2_amt">Waiting for Shipment from Supplier</p></div>');

                $('#shipment2').corner();
              
                self.listen_for_shipment();
            });
    };
    
    this.step2_btn_click = function() {
        var self = this;
        $.ajax({
                data: {
                        period: self.get_period(),
                        step: 'step2'
                },
                success: function(data, textStatus) {
                    if ('error' in data) {
                        log_error(data['error']);
                    }
                    else if ('step2' in data) {
                        if (data['step2'] != null) {
                            self.set_order(data['step2']); 
                        }
                        else {
                            log_error('current order returned null value');
                        }
                    }
                    else {
                        log_error('error returning step2');
                    }
                }

        });
        $('#ship_btn').attr('disabled',true); 
        $('#ship_btn').val('waiting...'); 
        self.listen_for_can_ship();

        $('#order1').fadeOut(FADE_SPEED, function() {
            $('#order1').remove();
            $('#order2').attr('id','order1');
            $('#order2_amt').attr('id','order1_amt');
            $('#order1 > h4').text('Incoming Order #1');
            $('#order1').after('<div id="order2" class="lead_tile">' + 
                '<h4>Incoming Order #2</h4><p id="order2_amt">Waiting for Order from Customer</p></div>');
            
            $('#order2').corner();

            self.set_shipment_recommendation();

            self.listen_for_order();
        });
    };

    this.ship_btn_click = function() {
        var self = this;
        // clear shipment errors
        $('#amt_to_ship').focus(function() {
            $('#shipment_errors').text('');
        });

        // handle amount to ship
        var amt_to_ship = parseInt($('#amt_to_ship').val());

        // check validate
        if (isNaN(amt_to_ship)) {
            $('#shipment_errors').text('Please enter a value!');
            $('#ship_btn').attr('disabled', false);
        }
        // is a valid number 
        else {

            // amount is in inventory
            if (amt_to_ship > this.get_inventory()) {
                $('#shipment_errors').text('Cannot ship more than inventory!');

                $.ajax({
                        data: {
                            set: 'last_clicked',
                            value: 'step2'
                        },
                        success: function(data, textStatus) {
                            if ('error' in data) {
                                log_error(data['error']);
                            }
                            else if (!'success' in data) {
                                log_error('set last clicked server communication failed');
                            }
                        }
                });
                $('#ship_btn').attr('disabled', false);
            }
            else {
                // take out inventory
                this.set_inventory(this.get_inventory() - parseInt(amt_to_ship));
                $.ajax({
                        data: {
                                shipment: amt_to_ship,
                                period: self.get_period()
                        },
                        success: function(data, textStatus) {
                            if ('error' in data) {
                                log_error(data['error']);
                            }
                        }
                });
            }
        }
    };

    this.step3_btn_click = function() {
        var self = this;
        $.ajax({
                dataType: 'html',
                data: {
                        period: self.get_period(),
                        step: 'step3'
                },
                success: function(data, textStatus) {
                    $('#period_table').html(data);
                }
        });

        $('#order_btn').attr('disabled', true); 
        $('#order_btn').val('waiting...'); 
        self.listen_for_can_order();
    };

    this.order_btn_click = function() {
        var self = this;
        // clear order errors
        $('#amt_to_order').focus(function() {
            $('#order_errors').text('');
        });
        var order = this.get_amt_to_order();

        if (isNaN(order)) {
            $('#order_errors').text('Please enter a value to order!');
            $('#order_btn').attr('disabled',false);
        }
        else { 
            $.ajax({
                    data: {
                            order: order,
                            period: self.get_period()
                    },
                    success: function(data, textStatus) {
                        if ('error' in data) {
                            log_error(data['error']);
                        }
                        // after ordering refresh period table
                        self.reload_period_table();
                                                    
                        // start waiting for other teams
                        // so we can start next period
                        self.wait_for_teams();
                    }
                });
            }
    };

    // constructors
    this.get_period();
    this._reset_inventory();
    this._reset_backlog();
}

/*
 * Buttons object abstracts all the button
 * functionality for main game buttons
 */
function Buttons() {
    this.last_clicked = undefined;

    this.next_buttons = {
                        'start':'step1_btn',
                        'step1':'step2_btn',
                        'step2':'ship_btn',
                        'ship':'step3_btn',
                        'step3':'order_btn'
                       }

    this.enable_next = function(name) {
        console.log('next button: '+name);
        $('#'+this.next_buttons[name]).attr('disabled',false);
    };

    this.set_last_clicked = function(name) {
        this.last_clicked = name;
        $.ajax({
            data: {
                    set: 'last_clicked',
                    value: name
            },
            success: function(data, textStatus) {
                if ('error' in data) {
                    log_error(data['error']);
                }
            }
        });
    };

    this.disable_current = function(id) {
        // disable current button
        $(id).attr('disabled',true);
    };

    // meta function, pulls the rest into one
    this.button_click = function(name, id) {
        this.set_last_clicked(name);
        this.disable_current(id);
        this.enable_next(name);
    };
}

$(document).ready(function() {
    // check if on game page, if so setup the game
    if ($('#next_period_btn').get().length == 1) {
        // disable all buttons
        $('.button').attr('disabled',true);

        // initialize Game, Button object
        var game = new Game();
        var buttons = new Buttons();

        game.set_buttons();
        game.set_timers();

        // handle all button click events
        $(buttons).bind('button', function(evnt, name, id) {
            console.log('button clicked with attributes: ' + name + ' ' + id);
            buttons.button_click(name, id);
        });

        $(game).bind('next_period_btn', function() {
            console.log('caught next_period_btn event');
            game.next_period_btn_click();
        });
        $(game).bind('step1_btn', function() {
            console.log('caught step1 btn event');
            game.step1_btn_click();
        });
        $(game).bind('step2_btn', function() {
            console.log('caught step2 btn event');
            game.step2_btn_click(); 
        });
        $(game).bind('ship_btn', function() {
            game.ship_btn_click();
        });
        $(game).bind('step3_btn', function() {
            game.step3_btn_click()
        });
        $(game).bind('order_btn', function() {
            game.order_btn_click();
        });

        /* BUTTON CLICK HANDLERS */
        var BUTTONS = [
                        ['start', '#next_period_btn'],
                        ['step1', '#step1_btn'],
                        ['step2', '#step2_btn'],
                        ['ship', '#ship_btn'],
                        ['step3', '#step3_btn'],
                        ['order', '#order_btn']
                    ];

        /* // TODO get this to work
        for (var idx in BUTTONS) {
            console.log(BUTTONS[idx]);
            $(BUTTONS[idx][1]).click(function() {
                var self = idx;
                $(buttons).trigger('button', eval(BUTTONS[self])); 
                $(game).trigger(BUTTONS[self][1].replace('#',''));
            });
        }
        */

        // start
        $(BUTTONS[0][1]).click(function() {
            $(buttons).trigger('button', BUTTONS[0]);
            $(game).trigger(BUTTONS[0][1].replace('#',''));
        });
        // step1
        $(BUTTONS[1][1]).click(function() {
            $(buttons).trigger('button', BUTTONS[1]);
            $(game).trigger(BUTTONS[1][1].replace('#',''));
        });
        // step2
        $(BUTTONS[2][1]).click(function() {
            $(buttons).trigger('button', BUTTONS[2]);
            $(game).trigger(BUTTONS[2][1].replace('#',''));
        });
        // ship
        $(BUTTONS[3][1]).click(function() {
            $(buttons).trigger('button', BUTTONS[3]);
            $(game).trigger(BUTTONS[3][1].replace('#',''));
        });
        // step3
        $(BUTTONS[4][1]).click(function() {
            $(buttons).trigger('button', BUTTONS[4]);
            $(game).trigger(BUTTONS[4][1].replace('#',''));
        });
        // order
        $(BUTTONS[5][1]).click(function() {
            $(buttons).trigger('button', BUTTONS[5]);
            $(game).trigger(BUTTONS[5][1].replace('#',''));
        });
        /* END BUTTON CLICK HANDLERS */
    }

    // setup jquery ui datepicker for control panel
    $('#datetime').datepicker({
        duration: '',
        showTime: true,
        constrainInput: false,
        stepMinutes: 10,
        stepHours: 1,
        altTimeField: '',
        time24h: false
    });

    // configure jGrowl
    $.jGrowl.defaults.position = "bottom-right";

});

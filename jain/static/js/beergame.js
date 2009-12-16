// LOGGING
jQuery.fn.log = function (msg) {
    console.log("%s: %o", msg, this);
    return this;
};

function log_error(msg) {
    $('#errors ul').prepend('<li>'+msg+'</li>');
}

(function() {

var BeerGame = function() {
    // remap jQuery to local variable
    // so we don't break in compatibility mode
    var $ = window.jQuery;

    /* CONSTANTS */
    var DEBUG = true;
    var CHECK_INTERVAL = 4000; // milliseconds to hit server for updates
    var FADE_SPEED = 700; // milliseconds for fade

    // if AJAX_URL is already set, we'll use that
    // this is used for testing page
    if (typeof window.AJAX_URL == "undefined") {
        AJAX_URL = 'ajax/'; 
    } 
    /* END CONSTANTS */

    /* CONFIGURATION */
    // configure AJAX 
    $.ajaxSetup({
        url: AJAX_URL, 
        cache: false,
        type: 'POST',
        dataType: 'json',
        error: function(req, stat, err) {
            log_error('ajax error: '+stat+' - '+err);
        }
    });

    // configure jGrowl
    $.jGrowl.defaults.position = "bottom-right";
    /* END CONFIGURATION */

    // ATTRIBUTES 
    this.period;
    this.inventory;
    this.backlog;
    this.last_clicked;

    // METHODS

    // DEBUGGING
    // TODO make more generlized logging
    this.log_debug = function(msg) {
        if (window.console && DEBUG) {
            console.log(msg);
        }
    };
    // END DEBUGGING

    // NOTIFICATIONS
    // outputs a message using jGrowl
    this.display_message = function(msg) {
        $.jGrowl(msg);
    };
    // END NOTIFICATIONS

    // get the current inventory 
    this.get_inventory = function() {
        if (this.inventory !== undefined) {
            return this.inventory;
        }
        // try to get inventory from
        // the HTML
        var inv_elm = $('#inv_amt');
        var inv_num = parseInt(inv_elm.text(), 10);

        if (!isNaN(inv_num)) {
            this.inventory = inv_num;
            return this.inventory; 
        }
        // an error?
        // can't get inventory from HTML
        // get inventory from server
        log_error('Inventory was not an integer');
        this._reset_inventory();
        return this.inventory;
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
                self.error_check(data);
                if ('inventory' in data) {
                    self.inventory = parseInt(data.inventory, 10);
                }
            }
        });
    };

    this.get_period = function() {
        if (this.period !== undefined) {
            return this.period;
        }
        // attempt to get period from HTML
        var period_text = $('#period_num').text();
        var html_period = parseInt(period_text, 10);
        if (!isNaN(html_period)) {
            this.period = html_period;
            return html_period;
        }
        if (period_text.indexOf('Just started') >= 0) {
            this.period = 0;
            return 0;
        }
        // can't get from HTML, get from server
        log_error('unable to get period from HTML');
        this._reset_period();
        return this.period;
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
                self.error_check(data);
                if ('period' in data) {
                    self.period = parseInt(data.period, 10);
                }
            }
        });
    };

    // incoming shipments 
    this.get_shipment1 = function() {
        return parseInt($('#ship1_amt').text(), 10); 
    };

    this.set_shipment1 = function(val) {
        $('#ship1_amt').text(val);
    };

    // incoming orders
    this.get_order = function() {
        var order = parseInt($('#order_amt').text(), 10); 
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
        var shipment_input = $('#amt_to_ship');
        shipment_input.val(val);

        if (select) { shipment_input.select(); }
    };
    
    // outgoing order
    this.get_amt_to_order = function() {
        return parseInt($('#amt_to_order').val(), 10);
    };

    this.set_amt_to_order = function(val) {
        $('#amt_to_order').val(val);
    };

    this.get_shipment_recommendation = function(backlog, inventory, order) {
        this.log_debug('backlog: '+backlog);
        this.log_debug('inventory: '+inventory);
        this.log_debug('order: '+order);
        // backlog
        if (backlog > 0) {
            // can deliver both backlog and order
            if (inventory >= (backlog + order)) {
                return backlog + order;
            }
            // can't deliver full backlog and order
            return inventory; 
        }
        // no backlog
        // order is more than inventory
        if (order > inventory) {
            return inventory; 
        }
        // order is less than inventory
        return order;
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
        this._reset_backlog();
        return this.backlog;
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
                self.error_check(data);
                if ('backlog' in data) {
                    self.backlog = parseInt(data.backlog, 10);
                }

            }
        });
    };

    
    /*
     * @data - data returned from ajax request
     * returns true if no errors
     */
    this.error_check = function(data) {
        if (data.error !== undefined) {
            log_error(data.error);
            return false;
        }
        return true;
    };

    /*
     * @timer_elm - object for timer
     * @type - query type: "get" or "check"
     * @item - what to be getting examples 
     *         shipment_2 and order_2
     * @success(data) - function to call after success
     * @waiting(data) - function to call while waiting
     *
     */
    this.check_until = function(timer_elm, type, item, success, waiting) {
        var self = this;
        // XXX make timer_elm self?
        function check(has_timer) {
            data = { period: self.get_period() };
            data[type] = item;
            $.ajax({
                data: data,
                success: function(data, stat) {
                    self.error_check(data);
                    if (type == 'get') {
                        if (data[item] !== null) {
                            if (has_timer) { $(timer_elm).stopTime(); }
                            success(data);
                        }
                    } else if (type == 'check') {
                        if (data[item]) {
                            if (has_timer) { $(timer_elm).stopTime(); }
                            success(data);
                        } else {
                            waiting(data);
                        }
                    }
                }
            });
        }
        // for more game responsiveness
        check(false);
        $(timer_elm).everyTime(CHECK_INTERVAL, function() {
            check(true);
        });
    };

    this.listen_for_can_ship = function() {
        var self = this;
        this.check_until('#step2_btn', 'check', 'can_ship',
            function() {
                $('#ship_btn').attr('disabled',false); 
                $('#ship_btn').val('Ship'); 
                self.display_message('You can now ship');
            },
            function() {
                // do nothing while waiting
            }
        );
    };

    // waits until the supplier can receive an order 
    this.listen_for_can_order = function() {
        var self = this;
        this.check_until('#step3_btn', 'check', 'can_order',
            function() {
                $('#order_btn').attr('disabled',false); 
                $('#order_btn').val('Order'); 
                $('#step3_btn').stopTime();
                self.display_message('You can now order');
            },
            function() {
                // do nothing while waiting
            }
        );
    };

    // TODO can i make this a better function name? 
    this.listen_for_shipment = function() {
        this.check_until('#step1', 'get', 'shipment_2', function(data) {
            $('#shipment2').remove();
            $('#shipment1').after(data.html);
            $('#shipment2').corner();
            
            // this doesn't work, think of way to get shipment amount
            // and update the HTML without reloading the whole table
            //if (data.last_clicked == 'step3' || data.last_clicked == 'order') {
            //    this.reload_period_table();
            //}
            // TODO check if need to reload the period table
            // when shipment2 arrives to keep data current
            // It was AJAX requesting last_click and if it was
            // 'step3' or 'order' or 'none' then we reloaded the table
            // CONSIDER: adding that information to the request
        });
    };

    this.listen_for_order = function() {
        this.check_until('#step2', 'get', 'order_2', function(data) {
            if (data.display_orders) {
                $('#order2_amt').text(data.order_2);
            }
            $('#order2_amt').text('');
        });
    };

    /*
     * Waits for other teams to finish current period
     * before allowing players to advance to next period
     * Alerts which teams it is waiting for
     */
    this.wait_for_teams = function() {
        this.log_debug('calling wait for teams');
        var self = this;
        this.check_until('#order_btn', 'check', 'teams_ready', 
            function(data) {
                self.display_top_btn();
                var per_btn = $('#next_period_btn');
                per_btn.attr('disabled', false);
                per_btn.val('Start next period');

                // remove old notifications
                for (var jdx in data.ready) {
                    var elm = $(['.',data.ready[jdx]].join(''));
                    if (elm.length !== 0) {
                        // should only be one item
                        elm.remove();
                    }
                }
            },
            function(data) {
                if ('waiting_for' in data && self.get_period() !== 0) {
                    // XXX doing it like this seems inefficient
                    // has to search DOM for class objects, slower
                    // implement patch to jGrowl for ID to notification
                    // add new notifications
                    for (var idx in data.waiting_for) {
                        var role = data.waiting_for[idx];
                        if ($(['.',role].join('')).length === 0) {
                            $.jGrowl(['Waiting for ',role].join(' '), 
                                {   
                                    sticky: true, 
                                    theme: role
                                });
                        }
                    }
                    // remove old notifications
                    for (var jdx in data.ready) {
                        var elm = $(['.',data.ready[jdx]].join(''));
                        if (elm.length !== 0) {
                            // should only be one item
                            elm.remove();
                        }
                    }
                }
            }
        );
    };

    // sets the state of the game with
    // buttons and timers
    this.set_game_state = function() {
        var self = this;
        $.ajax({
                data:   { 
                            query: 'last_clicked',
                            period: this.get_period()
                        },
                success: function(data, textStatus) {
                    // sets button states
                    var btns = {
                                    start:  'next_period_btn',
                                    step1:  'step1_btn',
                                    step2:  'step2_btn',
                                    ship:   'ship_btn',
                                    step3:  'step3_btn',
                                    order:  'order_btn'
                                };
                    var last_clicked = data.last_clicked;
                    if (last_clicked == 'none' || last_clicked == 'order') {
                        for (var btn in btns) {
                            $('#'+btns[btn]).attr('disabled',true);
                        }
                        if (self.get_period() === 0) {
                            // this need to do more
                            $(['#',btns.start].join('')).attr('disabled',false);
                        } else {
                            self.wait_for_teams();
                        }
                    }
                    else if (last_clicked in btns) {
                        var disable = true;
                        for (var ctn in btns) {
                            $('#'+btns[ctn]).attr('disabled',disable);
                            if (!disable) { disable = true; }
                            if (ctn == last_clicked) { disable = false; }
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
        
                    // sets the listens for shipments and orders
                    if ('last_clicked' in data) {
                        var last_clicked = data.last_clicked;

                        if (last_clicked == 'step1' || last_clicked == 'step2' || 
                            last_clicked == 'ship' || last_clicked == 'step3' || 
                            last_clicked == 'order') {

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
        // kill the wait for teams timer
        // for those people that are fast clickers
        $('#order_btn').stopTime();
        var self = this;
        $.ajax({
                data: {
                    step: 'start',
                    period: self.get_period()
                }, success: function(data, stat) {
                    self.error_check(data);
                }
        });

        // must increment after sending period
        // to server
        this.increment_period();
        
        // hides the back to top button
        // that appears at the bottom after order
        // button is clicked
        this.hide_top_btn();

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
                    self.error_check(data);

                    // remove shipment1 div
                    var ship1_div = $('#shipment1');
                    ship1_div.fadeOut(FADE_SPEED, function() { 
                        // increment the inventory
                        self.set_inventory(self.get_inventory()+self.get_shipment1());
                        ship1_div.remove(); 

                        // change ship2 to ship1
                        var ship2_div = $('#shipment2');
                        ship2_div.attr('id','shipment1');
                        $('#ship2_amt').attr('id','ship1_amt');
                        $('#shipment1 > h4').text('Shipment1'); 
                        $('#shipment1').after(data.html);
                        $('#shipment2').corner();
                      
                        self.listen_for_shipment();
                    });
                }
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
                self.error_check(data);
                if ('step2' in data) {
                    if (data.step2 !== null) {
                        self.set_order(data.step2); 
                    }
                    else {
                        log_error('current order returned null value');
                    }
                }
                $('#ship_btn').attr('disabled',true); 
                $('#ship_btn').val('waiting...'); 

                self.listen_for_can_ship();

                $('#order1').fadeOut(FADE_SPEED, function() {
                    $('#order1').remove();
                    $('#order2').attr('id','order1');
                    $('#order2_amt').attr('id','order1_amt');
                    $('#order1 > h4').text('Incoming Order #1');
                    $('#order1').after(data.html);
                    $('#order2').corner();

                    self.set_shipment_recommendation();

                    self.listen_for_order();
                });
            }
        });
    };

    this.ship_btn_click = function() {
        var self = this;
        // clear shipment errors
        $('#amt_to_ship').focus(function() {
            $('#shipment_errors').text('');
        });

        // handle amount to ship
        var amt_to_ship = parseInt($('#amt_to_ship').val(), 10);

        // check if number 
        if (isNaN(amt_to_ship)) {
            $('#shipment_errors').text('Please enter a value!');
            $('#ship_btn').attr('disabled', false);
        }
        else if (amt_to_ship < 0) {
            $('#shipment_errors').text('Please enter non-negative value!');
            $('#ship_btn').attr('disabled', false);
        }
        else if (amt_to_ship > this.get_order() + this.get_backlog()) {
            $('#shipment_errors').text('Shipment cannot exceed the order + backlog!');
            $('#ship_btn').attr('disabled', false);
        }
        // is a valid number 
        else {

            // amount is in inventory
            if (amt_to_ship > this.get_inventory()) {
                $('#shipment_errors').text('Cannot ship more than inventory!');
                $('#ship_btn').attr('disabled', false);
            }
            else {
                // take out inventory
                this.set_inventory(this.get_inventory() - parseInt(amt_to_ship, 10));
                $.ajax({
                        data: {
                                shipment: amt_to_ship,
                                period: self.get_period()
                        },
                        success: function(data, textStatus) {
                            self.error_check(data);
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

    this.display_top_btn = function() {
        var top_btn = $('#top_btn');
        top_btn.attr('disabled',false);
        top_btn.fadeIn('slow');
    };

    this.hide_top_btn = function() {
        var top_btn = $('#top_btn');
        top_btn.attr('disabled',true);
        top_btn.fadeOut('slow');
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
        else if (order < 0) {
            $('#order_errors').text('Please enter a non-negative value!');
            $('#order_btn').attr('disabled',false);
        }
        else { 
            $.ajax({
                    data: {
                            order: order,
                            period: self.get_period()
                    },
                    success: function(data, textStatus) {
                        self.error_check(data);

                        // after ordering refresh period table
                        self.reload_period_table();
                                                    
                        // start waiting for other teams
                        // so we can start next period
                        self.wait_for_teams();
                    }
                });
            }
    };

    $(this)
        .bind('next_period_btn', function() {
            this.log_debug('caught next_period_btn event');
            this.next_period_btn_click();
        })
        .bind('step1_btn', function() {
            this.log_debug('caught step1 btn event');
            this.step1_btn_click();
        })
        .bind('step2_btn', function() {
            this.log_debug('caught step2 btn event');
            this.step2_btn_click(); 
        })
        .bind('ship_btn', function() {
            this.ship_btn_click();
        })
        .bind('step3_btn', function() {
            this.step3_btn_click();
        })
        .bind('order_btn', function() {
            this.order_btn_click();
    });

    // constructors
    this.get_period();
    this.get_inventory();
    this.get_backlog();

    this.hide_top_btn(); 

    $('#top_btn').click(function() {
        self.hide_top_btn();
        window.scroll(0,0);
    });

    this.set_game_state();

    // BUTTONS

    this.last_clicked = undefined;

    this.BUTTONS = {
                    'start': '#next_period_btn',
                    'step1': '#step1_btn',
                    'step2': '#step2_btn',
                    'ship': '#ship_btn',
                    'step3': '#step3_btn',
                    'order': '#order_btn'
                  };

    this.NEXT_BUTTONS = {
                        'start':'step1_btn',
                        'step1':'step2_btn',
                        'step2':'ship_btn',
                        'ship':'step3_btn',
                        'step3':'order_btn'
                       };

    this.set_click_handlers = function() {
        var self = this;
        for (var btn in this.BUTTONS) {
            $(this.BUTTONS[btn]).data('name',btn).data('event','button');
            $(this.BUTTONS[btn]).click(function() {
                $(self).trigger($(this).data('event'), 
                                    [$(this).data('name'), $(this).attr('id')]);
                self.log_debug('calling game events');
                $(self).trigger($(this).attr('id'));
            });
        }
    };

    this.enable_next = function(name) {
        $('#'+this.NEXT_BUTTONS[name]).attr('disabled',false);
    };

    this.set_last_clicked = function(name) {
        this.last_clicked = name;
    };

    this.disable_current = function(id) {
        $(['#',id].join('')).attr('disabled',true);
    };

    // meta function, pulls the rest into one
    this.button_click = function(name, id) {
        this.set_last_clicked(name);
        this.disable_current(id);
        this.enable_next(name);
    };

    var self = this;
    // handle all button click events
    $(this).bind('button', function(evnt, name, id) {
        self.button_click(name, id);
    });

    // constructors
    this.set_click_handlers();

};

    // add to global namespace
    window.BeerGame = BeerGame;

})();

$(document).ready(function() {
    /* VISUAL ELEMENTS */
    $('.step_wrapper').corner("10px"); // for dark gray rounded corners
    $('.step').corner("8px"); // for light gray rounded corners 
    $('.lead_tile').corner(); // for orange rounded corners
    /* END VISUAL ELEMENTS */

    // check if on game page, if so setup the game
    if ($('#next_period_btn').get().length == 1) {
        // disable all buttons
        $('.button').attr('disabled',true);

        // activate game by creating beergame object
        var beerGame = new BeerGame(); 

    }

    // configure jGrowl
    $.jGrowl.defaults.position = "bottom-right";
});

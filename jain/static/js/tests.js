$(document).ready(function() {
    /*
    test('shipment recommendation', function() {
        equals(get_shipment_recommendation(20, 30, 15), 30, 'check inventory with backlog'); 
        equals(get_shipment_recommendation(0, 18, 19), 18, 'check when order is greater than inventory'); 
        equals(get_shipment_recommendation(0, 37, 37), 37, 'check when order and inventory are the same'); 
        equals(get_shipment_recommendation(0, 100, 3), 3, 'check when order less than inventory'); 

        set_shipment(3);
        equals(get_shipment(), "3", 'check setting/getting of shipment');
        set_shipment(""); // reset

        // need to figure out how to test giving latency of ajax
        //set_order(5); // just for testing
        //set_shipment_recommendation();
        //equals(get_shipment(), "5", 'check that shipment recommendation gets set');
        //set_order(""); // reset order
        //set_shipment("", false); // reset shipment
    });

    test('period management', function() {
        equals(get_period(), 0, 'just started');
        set_period(1); // change period and check
        equals(get_period(), 1, 'numerical period');
        set_period('Just Started'); // set it back for consistancy
    });

    test('inventory management', function() {
        equals(get_inventory(), 12, 'check beginning inventory');
        set_inventory(35);
        equals(get_inventory(), 35, 'check changed inventory');
        set_inventory(12); // change back
    });

    test('order management', function() {
        equals(get_order(), false, 'should be blank');
        set_order(20); // change order
        equals(get_order(), 20, 'check numerical order');
        set_order(""); // put back to blank
    });
    */

    var game = new Game();
    test('game object', function() {
        // tests setters and getters
        equals(game.get_period(), 0, 'check get_period');
        game.increment_period();
        equals(game.get_period(), 1, 'check increment_period');
        // check that period get changed in HTML
        equals($('#period_num').text(), "1", 'check changes to HTML');
        game._reset_period();
        equals(game.get_period(), 0, 'check reset_period');
        equals(game.get_inventory(), 12, 'check get_inventory');
        game.set_inventory(20);
        equals(game.get_inventory(), 20, 'check set_inventory');
        game._reset_inventory();
        equals(game.get_inventory(), 12, 'check reset_inventory');
    });

    test('steps actions', function() {
        game.set_order('10');
        equals(game.get_order(), 10, 'check set_order');
    });
});


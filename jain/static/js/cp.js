$(document).ready(function() {
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
});



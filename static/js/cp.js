// configure AJAX 
$.ajaxSetup({
    cache: false,
    type: 'POST',
    dataType: 'json',
});

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
    // for control panel, generating chart select
    $('#chart-select').change(function() {
        if ($(this).val() != 'none') {
            $('#chart-output').text('loading chart...');
            $.ajax({
                    url: 'chart/',
                    data: {
                        id: $(this).val() 
                    },
                    success: function(data, stat) {
                        var output = ['<a href="', data.chart,
                                        '">Beer game results for ',
                                        data.name, '</a>'].join('');
                        $('#chart-output').html(output);
                    }
            });
        }
    });

});



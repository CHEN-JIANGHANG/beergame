from django.conf.urls.defaults import *

urlpatterns = patterns('',
    url(r'^$', 'beergame.views.start'),
    url(r'^join_game/(?P<game>\d+)/$', 'beergame.views.join_game'),
    url(r'^create_game$', 'beergame.views.create_game'),
    url(r'^game/(?P<game>\d+)/(?P<role>\w+)/$', 'beergame.views.game'),
    url(r'^game/(?P<game>\d+)/(?P<role>\w+)/ajax/$', 'beergame.views.ajax'),
    (r'^login/', 'django.contrib.auth.views.login', {'template_name':'login.html'}),
    url(r'^logout/', 'beergame.views.logout_view'),
    url(r'^cp/$','beergame.views.cp'),
    url(r'^cp/spreadsheet/$','beergame.views.output_csv'),
    url(r'^cp/chart/$','beergame.views.get_chart'),
    url(r'^jstest/$','beergame.views.js_test'),
)

from django.conf.urls.defaults import *

urlpatterns = patterns('',
    url(r'^$', 'bgame.views.start'),
    url(r'^join_game/(?P<game>\d+)/$', 'bgame.views.join_game'),
    url(r'^create_game$', 'bgame.views.create_game'),
    url(r'^game/(?P<game>\d+)/(?P<role>\w+)/$', 'bgame.views.game'),
    url(r'^game/(?P<game>\d+)/(?P<role>\w+)/ajax/$', 'bgame.views.ajax'),
    (r'^login/', 'django.contrib.auth.views.login', {'template_name':'login.html'}),
    url(r'^logout/', 'bgame.views.logout_view'),
    url(r'^cp/$','bgame.views.cp'),
    url(r'^cp/spreadsheet/$','bgame.views.output_csv'),
    url(r'^cp/chart/$','bgame.views.get_chart'),
    url(r'^jstest/$','bgame.views.js_test'),
)

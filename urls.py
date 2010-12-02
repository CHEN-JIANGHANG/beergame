import os

from django.conf.urls.defaults import *
from django.conf import settings

# Uncomment the next two lines to enable the admin:
from django.contrib import admin
admin.autodiscover()

urlpatterns = patterns('',
    (r'^static/(?P<path>.*)$', 'django.views.static.serve',
              {'document_root': os.path.join(settings.PROJECT_DIR, 'static'), 'show_indexes': True}),

    (r'^admin/', include(admin.site.urls)),

    (r'', include('bgame.urls')),
)

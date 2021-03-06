// Helper functions
function getUrlParameter(sParam)
{
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++) 
    {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam) 
        {
            return sParameterName[1];
        }
    }
}

// Smallest empty image
// http://stackoverflow.com/questions/9126105/blank-image-encoded-as-data-uri
var emptyImg = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

// Loading spinner
var spinOpts = {
  lines: 13, // The number of lines to draw
  length: 20, // The length of each line
  width: 10, // The line thickness
  radius: 50, // The radius of the inner circle
  corners: 1, // Corner roundness (0..1)
  rotate: 0, // The rotation offset
  direction: 1, // 1: clockwise, -1: counterclockwise
  color: '#000', // #rgb or #rrggbb or array of colors
  speed: 1, // Rounds per second
  trail: 60, // Afterglow percentage
  shadow: true, // Whether to render a shadow
  hwaccel: false, // Whether to use hardware acceleration
  className: 'spinner', // The CSS class to assign to the spinner
  zIndex: 2e9, // The z-index (defaults to 2000000000)
  top: '50%', // Top position relative to parent
  left: '50%' // Left position relative to parent
};

var map, localStorageItem = 'fieldcorrespondent-data';

// Loading from local storage
var loadFromLocalStorage = function(){
  if (localStorage)
  {
    var loadedData = JSON.parse(localStorage.getItem(localStorageItem));
    console.log("Loaded from local storage: "+JSON.stringify(loadedData));
    return loadedData || {};
  }
}

$().ready(function() {
  // Project ID: passed in URL or default to 1
  var proj_id = getUrlParameter('id') || 'ncjp';

  // Previously highlighted feature
  var featNameAttr = 'name';
  var featDescAttr = 'description';
  var featOpts = {};
  featOpts[featNameAttr] = 'Dummy';
  var prevFeature = new ol.Feature(featOpts);

  // Style cache
  var featStyleCache = {}, featStyleCache2 = {};
  var clickedFeature;

  // Start the spinner in the spinner div
  var target = document.getElementById('spinDiv');
  var spinner = new Spinner(spinOpts).spin(target);

  // Minidash / dashteaser div: click behaviour
  var openDash = function(){
    $('#minidashDiv').animate({left:0},200);
    $('#dashTeaser').css({'opacity':0,'cursor':'default'});    
  }
  $('#dashTeaser').click(openDash);

  var closeDash = function(){
    $('#minidashDiv').animate({left:-260},200);
    $('#dashTeaser').css({'opacity':1,'cursor':'pointer'});    
  }
  $('#fulldash').click(closeDash);

  var refreshDash = function(){
    // If the local storage contains a contributor name, use that to expand the query
    var d = loadFromLocalStorage(), expandedQuery = "";
    if (d["Contributor"])
    {
      expandedQuery = ",'"+d["Contributor"]+"' AS contributor,(SELECT count(*) FROM fc_observations o WHERE form_data::json->>'credit'='"+d["Contributor"]+"' AND o.dataset_id=p.dataset_id) AS user_obs_count,(SELECT count(distinct feature_id) FROM fc_observations o WHERE form_data::json->>'credit'='"+d["Contributor"]+"' AND o.dataset_id=p.dataset_id) AS user_feat_count,(SELECT rank FROM (SELECT o.form_data::json->>'credit' as who,rank() OVER (order BY count(*) desc) as rank FROM fc_observations o WHERE o.dataset_id=p.dataset_id GROUP BY form_data::json->>'credit') t WHERE who='"+d["Contributor"]+"') as user_rank";
    }
    $.ajax({
      url: "http://groundtruth.cartodb.com/api/v2/sql?q=SELECT (SELECT count(*) FROM fc_features f WHERE f.dataset_id=p.dataset_id) as tot_feat_count,(SELECT count(distinct f.feature_id) FROM fc_features f,fc_observations o WHERE f.dataset_id=p.dataset_id AND f.feature_id=o.feature_id AND o.dataset_id=p.dataset_id) as obs_feat_count"+expandedQuery+" FROM public.fc_projects p WHERE p.key='"+ proj_id+"'"
    }).done(function(response){
      var data = response.rows[0];
      // Injecting the results in the project stat
      var pct_complete = Math.round(parseFloat(data.obs_feat_count)/data.tot_feat_count*10*100)/10;
      $('#stats_proj_teaser').html(pct_complete+'%');
      $('#stats_proj').html(pct_complete + '% ('+data.obs_feat_count+' sites visited out of '+data.tot_feat_count+')');
      $('#observations_link').attr('href',$('#observations_link').attr('href')+proj_id);

      if (data.contributor, data.user_obs_count && data.user_feat_count)
      {
        $('#dashTeaser').css({'margin':'185px 0 0 0'});
        $('#user_name').html(data.contributor);
        $('#stats_user').html(data.user_obs_count+' observation'+(data.user_obs_count>1?'s':'')+' on '+data.user_feat_count+' site'+(data.user_feat_count>1?'s':''));
        var num_suff;
        switch (data.user_rank % 10)
        {
          case 1:
            num_suff = 'st';break;
          case 2:
            num_suff = 'nd';break;
          case 3:
            num_suff = 'rd';break;
          default:
            num_suff = 'th'; 
        }
        $('#user_rank').html(data.user_rank+'<sup>'+num_suff+'</sup> biggest contributor');
        $('#my_observations_link').html("All "+data.contributor+"'s contributions")
          .attr('href',$('#my_observations_link').attr('href')+proj_id);
      }
    });
  }
  refreshDash();

  // Promise to execute the map initialisation when all config AJAX calls have been fulfilled
  $.when( 
    // Project specific information - should return a filter element for the feature query
    $.ajax({
      url: "http://groundtruth.cartodb.com/api/v2/sql?q=SELECT p.cartodb_id,p.dataset_id,p.title,pe.type,pe.key,(SELECT ST_AsText(ST_Buffer(ST_Extent(f.the_geom),0)) FROM fc_features f WHERE f.dataset_id=p.dataset_id) the_geom FROM public.fc_projects p, fc_project_elements pe WHERE p.key='"+ proj_id+"' AND pe.project_id::int=p.cartodb_id ORDER BY interface_element_id"
    })
  ).done(function(a1) {
    // Each argument is an array with the following structure: [ data, statusText, jqXHR ]
    // When only 1 query, the result is the straight data object (not an array)
    initMap([a1]);

    // Set project title on
    $('.proj_title').html(a1.rows[0].title);
  });

  var initMap = function(cfg1) {

    var viewOpts = {
      center: [0, 0],
      zoom: 2
    };

    var view = new ol.View(viewOpts);

    var getBadge = function(feature, resolution) {
      var text = feature.get('badge');
      if (text == 0){text = '';}
      return '' + text;
    };

    var createBadgeStyle = function(feature, resolution) {
      return new ol.style.Text({
        textAlign: 'center',
        textBaseline: 'middle',
        font: 'bold 12px Arial',
        text: getBadge(feature, resolution),
        fill: new ol.style.Fill({color: '#ffffff'}),
        stroke: new ol.style.Stroke({color: '#FFA500', width: 6}),
        offsetX: 22,
        offsetY: -14
      });
    };

    var getText = function(feature, resolution) {
      var text = feature.get(featNameAttr) || '';
      return text;
    };

    var createTextStyle = function(feature, resolution) {
      return new ol.style.Text({
        textAlign: 'center',
        textBaseline: 'middle',
        font: 'bold 12px Arial',
        text: getText(feature, resolution),
        fill: new ol.style.Fill({color: '#666'}),
        stroke: new ol.style.Stroke({color: '#ffffff', width: 6}),
        offsetX: 0,
        offsetY: 8
      });
    };

    var styleOff = function(feature, resolution) {
      var styleKey = 0;
      var styleArray = featStyleCache2[styleKey];
        styleArray = [
          new ol.style.Style({
            image: new ol.style.Icon(/** @type {olx.style.IconOptions} */ ({
              anchor: [0.5, 51],
              anchorXUnits: 'fraction',
              anchorYUnits: 'pixels',
              opacity: 0.70,
              src: 'img/a.png'
            })),
            zIndex: 1
          }),
          new ol.style.Style({
            text: createBadgeStyle(feature, resolution),
            zIndex: 1
          })
        ];
        featStyleCache2[styleKey] = styleArray;
      return styleArray;
    };

    var styleOn = function(feature, resolution) {
      var styleKey = 0;
      var styleArray = featStyleCache[styleKey];
        styleArray = [
          new ol.style.Style({
            text: createTextStyle(feature, resolution),
            image: new ol.style.Icon(/** @type {olx.style.IconOptions} */ ({
              anchor: [0.5, 57],
              anchorXUnits: 'fraction',
              anchorYUnits: 'pixels',
              opacity: 0.95,
              src: 'img/c.png'
            })),
            zIndex: 2
          }),
          new ol.style.Style({
            text: createBadgeStyle(feature, resolution),
            zIndex: 3
          })
        ];
        featStyleCache[styleKey] = styleArray;
      return styleArray;
    };

    // Should use a filter from the project characteristics
    var vectorLayer = new ol.layer.Vector({
      source: new ol.source.GeoJSON({
        url: "https://groundtruth.cartodb.com/api/v2/sql?filename=fc_features&q=SELECT+f.feature_id,"+featNameAttr+",f."+featDescAttr+",(select count(*) from fc_observations o where o.feature_id=f.feature_id AND o.dataset_id='"+cfg1[0].rows[0].dataset_id+"') as badge,ST_Centroid(f.the_geom)+the_geom+FROM+public.fc_features+f+WHERE+f.dataset_id='"+cfg1[0].rows[0].dataset_id+"'&format=geojson",
        projection: 'EPSG:3857'
      }),
      style: styleOff
    });

    map = new ol.Map({
      layers: [
        new ol.layer.Tile({
          source: new ol.source.XYZ({
            urls: [
              "http://1.base.maps.api.here.com/maptiler/2.1/maptile/newest/normal.day/{z}/{x}/{y}/256/png8?lg=ENG&app_id=NIEF2Bb3q1uSHV0AILtJ&token=ji8hmfQIabQA7--VT2HOAQ",
              "http://2.base.maps.api.here.com/maptiler/2.1/maptile/newest/normal.day/{z}/{x}/{y}/256/png8?lg=ENG&app_id=NIEF2Bb3q1uSHV0AILtJ&token=ji8hmfQIabQA7--VT2HOAQ",
              "http://3.base.maps.api.here.com/maptiler/2.1/maptile/newest/normal.day/{z}/{x}/{y}/256/png8?lg=ENG&app_id=NIEF2Bb3q1uSHV0AILtJ&token=ji8hmfQIabQA7--VT2HOAQ",
              "http://4.base.maps.api.here.com/maptiler/2.1/maptile/newest/normal.day/{z}/{x}/{y}/256/png8?lg=ENG&app_id=NIEF2Bb3q1uSHV0AILtJ&token=ji8hmfQIabQA7--VT2HOAQ"
            ],
            attributions:[
              new ol.Attribution({
                html: "<div style='text-align:center;pointer-events: auto;display: inline-block;background: url(http://m.here.com/fw/img/watermark_dark.png) no-repeat center top;-webkit-background-size: 1.6rem;-moz-background-size: 1.6rem;-o-background-size: 1.6rem;background-size: 1.6rem;-webkit-background-size: 1.6rem 1.25rem;-moz-background-size: 1.6rem 1.25rem;-o-background-size: 1.6rem 1.25rem;background-size: 1.6rem 1.25rem;padding-top: 1.55rem;white-space: nowrap;font-size: .45rem;color:#fff;font-weight:bold;'>&copy; 2011 - 2014 HERE.<br></span>&nbsp;<a href='http://here.com/terms?locale=en-US' target='_blank' title='Terms of Use' style='color:#fff;text-decoration: underline;font-weight:bold;'>Terms of Use</a></div>"
              })
            ]
          })
        }),
        vectorLayer
      ],
      renderer: 'canvas',
      target: 'map',
      view: view
      //,controls: ol.control.defaults({ attribution: false })
    });

    // Set center (and possibly zoom) for initial view
    if (cfg1[0].rows[0].the_geom)
    {
      var wkt = new ol.format.WKT();
      var polygon = wkt.readGeometry(cfg1[0].rows[0].the_geom).transform('EPSG:4326','EPSG:3857');
      var size = /** @type {ol.Size} */ (map.getSize());
      view.fitGeometry(
          polygon,
          size,
          {
            nearest: true
          }
      );
    }

    // Geolocation
    var geolocate = function () {
      // TODO: we could color code the icon to indicate GPS being acquired, successfully acquired, ... 
      var geolocation = new ol.Geolocation({
        projection: view.getProjection(),
        tracking: true,
        trackingOptions: {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 0
        }
      });

      geolocation.on('error', function() {
        console.log("GPS position not acquired successfully");
        // TODO: paint it red for a couple of seconds?
        $('#gpsDiv').animate({opacity:0},500).animate({opacity:1},500)
                  .animate({opacity:0},500).animate({opacity:1},500);
        // Stop tracking
        geolocation.setTracking(false);
      });

      geolocation.on('change:position', function() {
        // Zoom / pan animation effect
        var pan = ol.animation.pan({
          duration: 500, 
          source: view.getCenter()
        });
        var zoom = ol.animation.zoom({
          duration: 500,
          resolution: view.getResolution()
        });
        map.beforeRender(pan,zoom);

        // Zoom only if we were far to start with
        view.setCenter(geolocation.getPosition());
        if (view.getResolution() > 0.5971642834779395)
        {
          view.setResolution(0.5971642834779395);
        }

        // Stop tracking
        geolocation.setTracking(false);
      });
    }

    $('#gpsDiv').on('click',geolocate);

    var mapFeatureSelect = function(evt){
      var features = [];
      map.forEachFeatureAtPixel(evt.pixel, function(feature, layer) {
        if (prevFeature.get('feature_id') == feature.get('feature_id'))
        {
          features.push(feature);
        }
      });
      if (features.length > 0) {
        // TODO populate and show the form
        $('#formDiv').fadeTo(50,1,function(){
          // Displaying attribute info
          clickedFeature = features[0];
          $('#htitle').html(clickedFeature.get(featNameAttr));
          $('#hdesc').html(clickedFeature.get(featDescAttr));

          // Loading persistent values from local storage
          var s = loadFromLocalStorage();
          for (var k in s)
          {
            if (s.hasOwnProperty(k))
            {
              $('input[key='+k+']').val(s[k]);
            }
          }

          // Hiding the GPS
          $('#gpsDiv').hide();
          // Show the form
          $('#formDiv').show();
          // Activate photo input with a 500ms delay
          window.setTimeout(function(){
            $('input[name=photo_input]').attr('disabled',false);
          },500);          
        });
      }
    };

    // Showing the form on feature click
    map.on('click',mapFeatureSelect);
    //map.on('touchend',mapFeatureSelect);

    var mapHighlightClosest = function(){
      var c = map.getView().getCenter();
      //console.log('Center: '+c[0]+','+c[1]);

      if (c[0] != 0 && c[1] != 0)
      {
        var closestFeature = vectorLayer.getSource().getClosestFeatureToCoordinate(c);
        if (closestFeature)
        {
          if (closestFeature.get('feature_id') != prevFeature.get('feature_id'))
          {
            // Resetting the style of the previously selected feature
            if (prevFeature) {prevFeature.setStyle(styleOff(prevFeature));}
            // Styling the closest feature
            closestFeature.setStyle(styleOn(closestFeature));
            // Memorising feature for next style reset
            prevFeature = closestFeature;
          }        
        }
      }
    };

    // Changing style on map moveend
    map.on('moveend', mapHighlightClosest);

    // Build the form based on retrieved interface elements
    var buildForm = function(cfg){
      // Locating the form
      var f = $('form').submit(function(event){
        event.preventDefault();
        $('#submitButton').click();
        return false;        
      });

      var div_elt;

      //<div class="page-header">
      //  <h1>Example page header <small>Subtext for header</small></h1>
      //</div>
      var title_elt = $('<h3>').attr('id','htitle');
      var desc_elt = $('<p>').attr('id','hdesc');
      var header_elt = $('<div>')
                    .attr('class','text-left')
                    .css('color','black')
                    .append(title_elt)
                    .append(desc_elt);
      f.append(header_elt);

      // Adding elements to the form
      for (var k=0;k<cfg.length;k++)
      {
        // Adding a form input type file for the type "photo"
        //<div class="form-group">
        //  <label for="exampleInputFile">File input</label>
        //  <input type="file" id="exampleInputFile">
        //  <p class="help-block">Example block-level help text here.</p>
        //</div>    
        if (cfg[k].type == "photo")
        {
          div_elt = $('<div>').attr('class', 'form-group');
          var div_s1 = $('<label>')
                          .attr('for', 'photo_input')
                          .html('<h3>'+cfg[k].key+'</h3>');
          var div_s2 = $('<div>')
                          .attr('id','file_div_container')
                          .css({
                            position: 'absolute',
                            overflow: 'hidden',
                            left: '-500px'
                          })
                          .append(
                            $('<input>')
                            .attr('type', 'file')
                            .attr('name', 'photo_input')
                            .attr('disabled', true)
                          );
          var div_s3 = $('<div>')
                          .attr('id','photo_div_container')
                          .css({
                            display: 'inline-block'
                          })
                          .append(
                            $('<img>')
                            .attr('src', 'img/addphoto.png')
                            .css({
                              width: '60px',
                              margin: '10px',
                              cursor: 'pointer'
                            })
                          );
          var img_div = $('<div>')
                          .attr('id','img_div_container')
                          .css({
                            display: 'inline-block'
                          })
                          .append(
                            $('<img>').attr('id', 'thumb')
                            .css({
                              width: '100px',
                              height: '100px',
                              border: '0px'
                            })
                            .attr('src',emptyImg)
                          );
          div_s3.append(img_div);

          div_elt.append(div_s1).append(div_s2).append(div_s3);
          var img_progress = $('<p>')
                                  .attr('id','progressbar')
                                  .append($('<span>')
                                        .css({
                                          'display':'inline-block',
                                          'height':'15px',
                                          'background-color':'#51B11D',
                                          'text-align':'center',
                                          'font-size':'10px',
                                          'line-height':'15px'
                                        })
                                      );
          div_elt.append(img_progress);
        }

        // <input type="text" class="form-control" placeholder="Text input">
        if (cfg[k].type == "persistent_text")
        {
          div_elt = $('<div>').attr('class', 'form-group');
          var div_s1 = $('<label>')
                          .attr('for', 'text_input')
                          .html('<h3>'+cfg[k].key+'</h3>');
          var div_s2 = $('<input>')
                          .attr('type', 'text')
                          .attr('name', 'text_input')
                          .attr('key', cfg[k].key)
                          .css({
                            'margin':'0 10px'
                          });
          div_elt.append(div_s1).append(div_s2);
        }

        // Appending the div to the form
        f.append(div_elt);
      }

      // Click on photo img container should trigger the input file 'click' event 
      $('#photo_div_container').on('click',function(){
        var photo_input = $('input[name=photo_input]');
        //if (!photo_input.is(":disabled"))
        //{
          photo_input.trigger('click');
        //}
      });

      // When file changed, we resize it client-side
      $('input[name=photo_input]').change(function(e) {
        // A mini spinner to wait for image resizing
        var miniSpinOpts = $.extend(spinOpts,{lines:8,length:10,width:2,radius:10});
        var minitarget = document.getElementById('img_div_container');
        var minispinner = new Spinner(miniSpinOpts).spin(minitarget);

        var file = e.target.files[0];
        canvasResize(file, {
          width: 1200,
          height: 0,
          crop: false,
          quality: 80,
          //rotate: 90,
          callback: function(data, width, height) {
            $('#thumb').css({
              'height':'100px',
              'width':width/height*100+'px'
            });
            $('#thumb').attr('src', data);

            // Stopping the mini-spinner
            minispinner.stop();

            // Making the submit button clickable
            $('#submitButton').attr('disabled',false);
          }
        });
      });

      var formCleanup = function(response){
        if (response)
        {
          // When in dev, display the JSON returned (contains the cartodb query)
          if (getUrlParameter('mode')=='raw') {alert(JSON.stringify(response));}          
        }
        // Hiding the form
        $('#formDiv').hide();
        // Deactivate file input for next click
        $('input[name=photo_input]').attr('disabled',true);
        // Showing the GPS
        $('#gpsDiv').show();
        // Form fields reset
        // Source: http://jquery-howto.blogspot.com.au/2013/08/jquery-form-reset.html
        $('form')[0].reset();
        // Cleaning the image preview
        $('#thumb').attr('src',emptyImg);
        // Upload progress bar reset
        $('#progressbar span').css({width:'0%'}).html('');
        // Spin stopping
        $('#spinDiv').hide();
        // Making the submit button clickable for next entry
        $('#submitButton').attr('disabled',true);        

        clickedFeature = null;        
      }

      var separator_elt = $('<div>').css({
              'height': '10px'
            }).html('<hr>');

      f.append(separator_elt);

      var footer_elt = $('<div>').attr('class','panel-footer clearfix');

      // Adding the close button
      var b1 = $('<button>').attr('type','button')
            .css({
              'margin-left': '20px'
            })
            .attr('class','btn btn-default pull-left')
            .html('Cancel')
            .on('click',function(){
              $('#formDiv').fadeTo(150,0,function(){
                formCleanup();
              });
            });

      // Adding the buttons
      var b2 = $('<button>')
        .attr('id','submitButton')
        .attr('type','button')
        .attr('disabled',true)
        .css({
          'margin-right': '20px'
        })
        .attr('class','btn btn-success pull-right')
        .html('OK')
        .on('click',function(){
          //console.log('Submitting form');

          // Disabling the submit button straight away
          $('#submitButton').attr('disabled',false);  

          // Blur all fields to regain full view (no virtual keyboard!)
          $('input').blur();  

          // Starting the spinner!
          window.setTimeout(function(){
            $('#spinDiv').show();
          },250);

          // Create a new formdata
          var fd = new FormData();

          // Photo input
          fd.append("photo_input", canvasResize('dataURLtoBlob', $('#thumb').attr('src')));

          // Serialize will skip file input
          var other_data = $('form').serializeArray(), local_data = {};
          $.each(other_data,function(key,input){
              fd.append(input.name,input.value);
              // Persisting all field values marked as persistent
              local_data[$('input[name='+input.name+']').attr('key')]=input.value;
          });

          // 
          if (localStorage)
          {
            console.log("Persisting in local storage: "+JSON.stringify(local_data));
            localStorage.setItem(localStorageItem, JSON.stringify(local_data));
          }

          // Other data
          fd.append("dataset_id",cfg1[0].rows[0].dataset_id);
          fd.append("feature_id",clickedFeature.get('feature_id'));
          fd.append("map_view_x",map.getView().getCenter()[0]);
          fd.append("map_view_y",map.getView().getCenter()[1]);

          // Submit to PHP service
          $.ajax({
            url: 'ws/uploader.php',
            type: 'POST',
            data: fd,
            dataType: 'json',
            contentType: false,
            processData: false,
            beforeSend: function(xhr) {
                xhr.setRequestHeader("pragma", "no-cache");
            },
            xhr: function() {
              var xhr = new window.XMLHttpRequest();
              //Upload progress
              xhr.upload.addEventListener("progress", function(e) {
                if (e.lengthComputable) {
                  var loaded = Math.ceil((e.loaded / e.total) * 100);
                  $('#progressbar span').css({
                      'width': loaded + "%"
                  }).html("Uploaded: "+ loaded + "%");
                }
              }, false);
              return xhr;
            }
          }).done(function(response) {
            console.log(response);
            
            // Essential: for the user to witness change
            // Non-essential: refresh other user interactions
            if (response.url_imgur) {
              // Refresh the dashboard stats and show them for a few seconds
              refreshDash();
              openDash();
              window.setTimeout(closeDash,4000);

              // All good - cleanup the form
              $('#formDiv').fadeTo(150,0,function(){
                formCleanup(response);
              });

              // Increase the badge label for this observation
              var oldBadge = clickedFeature.get('badge') || 0;
              clickedFeature.set('badge',parseInt(oldBadge)+1);
              clickedFeature.setStyle(styleOn(clickedFeature));
            }
          });
        });
      // Adding buttons to footer
      footer_elt.append(b1).append(b2);

      // Adding footer to form
      f.append(footer_elt);
    }

    // Instantiating the form building
    buildForm(cfg1[0].rows);

  }
});

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

$().ready(function() {
  // Project ID: passed in URL or default to 1
  var proj_id = parseInt(getUrlParameter('id')) || 1;

  // Previously highlighted feature
  var featNameAttr = 'name';
  var featOpts = {};
  featOpts[featNameAttr] = 'Dummy';
  var prevFeature = new ol.Feature(featOpts);

  // Style cache
  var featStyleCache = {};
  var clickedFeature;

  // Promise to execute the map initialisation when all config AJAX calls have been fulfilled
  $.when( 
    // Project specific information - should return a filter element for the feature query
    $.ajax({
      url: "http://groundtruth.cartodb.com/api/v2/sql?q=SELECT p.cartodb_id,p.dataset_id,p.title,p.range,(SELECT ST_AsText(ST_Buffer(ST_Extent(f.the_geom),0)) FROM fc_features f WHERE f.dataset_id=p.dataset_id) the_geom FROM public.fc_projects p WHERE p.cartodb_id="+ proj_id
    }), 
    // Form structure (TODO: minimise number of calls by combining the 2 queries)
    $.ajax({
      url: "http://groundtruth.cartodb.com/api/v2/sql?q=SELECT * FROM public.fc_project_elements WHERE project_id='"+ proj_id +"' ORDER BY cartodb_id"
    }) 
  ).done(function( a1, a2 ) {
    // a1 and a2 are arguments resolved for the page1 and page2 ajax requests, respectively.
    // Each argument is an array with the following structure: [ data, statusText, jqXHR ]
    initMap(a1,a2);

    // Set project title on
    $('#infoDiv span').html(a1[0].rows[0].title);
  });

  var initMap = function(cfg1,cfg2) {

    var viewOpts = {
      center: [0, 0],
      zoom: 2
    };

    var view = new ol.View(viewOpts);

    var styleOff = new ol.style.Style({
      image: new ol.style.Icon(/** @type {olx.style.IconOptions} */ ({
        anchor: [0.5, 51],
        anchorXUnits: 'fraction',
        anchorYUnits: 'pixels',
        opacity: 0.70,
        src: 'img/a.png'
      }))
    });

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

    var styleOn = function(feature, resolution) {
      var styleKey = 0;
      var styleArray = featStyleCache[styleKey];
        styleArray = [new ol.style.Style({
          text: createTextStyle(feature, resolution),
          image: new ol.style.Icon(/** @type {olx.style.IconOptions} */ ({
            anchor: [0.5, 57],
            anchorXUnits: 'fraction',
            anchorYUnits: 'pixels',
            opacity: 0.95,
            src: 'img/c.png'
          })),
          zIndex: 1
        })];
        featStyleCache[styleKey] = styleArray;
      return styleArray;
    };

    // Should use a filter from the project characteristics
    var vectorLayer = new ol.layer.Vector({
      source: new ol.source.GeoJSON({
        url: "https://groundtruth.cartodb.com/api/v2/sql?filename=fc_features&q=SELECT+feature_id,"+featNameAttr+",ST_Centroid(the_geom)+the_geom+FROM+public.fc_features+WHERE+dataset_id='"+cfg1[0].rows[0].dataset_id+"'&format=geojson",
        projection: 'EPSG:3857'
      }),
      style: styleOff
    });

    var map = new ol.Map({
      layers: [
        new ol.layer.Tile({
          source: new ol.source.XYZ({
            urls: [
              "http://1.base.maps.api.here.com/maptiler/2.1/maptile/newest/normal.day/{z}/{x}/{y}/256/png8?lg=ENG&app_id=NIEF2Bb3q1uSHV0AILtJ&token=ji8hmfQIabQA7--VT2HOAQ",
              "http://2.base.maps.api.here.com/maptiler/2.1/maptile/newest/normal.day/{z}/{x}/{y}/256/png8?lg=ENG&app_id=NIEF2Bb3q1uSHV0AILtJ&token=ji8hmfQIabQA7--VT2HOAQ",
              "http://3.base.maps.api.here.com/maptiler/2.1/maptile/newest/normal.day/{z}/{x}/{y}/256/png8?lg=ENG&app_id=NIEF2Bb3q1uSHV0AILtJ&token=ji8hmfQIabQA7--VT2HOAQ",
              "http://4.base.maps.api.here.com/maptiler/2.1/maptile/newest/normal.day/{z}/{x}/{y}/256/png8?lg=ENG&app_id=NIEF2Bb3q1uSHV0AILtJ&token=ji8hmfQIabQA7--VT2HOAQ"
            ],
            attribution: "&copy; 1987 - 2014 HERE</span>&nbsp;<a href='http://here.com/terms?locale=en-US' target='_blank' title='Terms of Use' style='color:#333;text-decoration: underline;'>Terms of Use</a></div> <div style='display: inline-block; position: absolute; bottom: 15px; left: 10px; width: 33px; height: 24px; margin: 6px; background-image: url(http://js.cit.api.here.com/se/2.5.4/assets/ovi/mapsapi/here_logo.png); background-position: 0px 0px; background-repeat: no-repeat;' title='HERE'/>"
          })
        }),
        vectorLayer
      ],
      renderer: exampleNS.getRendererFromQueryString(),
      target: 'map',
      view: view
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
    var geolocation = new ol.Geolocation({
      projection: view.getProjection(),
      tracking: true
    });
    geolocation.once('change:position', function() {
      view.setCenter(geolocation.getPosition());
      view.setResolution(2.388657133911758);
    });

    // Showing the form on feature click
    map.on('click',function(evt){
      var features = [];
      map.forEachFeatureAtPixel(evt.pixel, function(feature, layer) {
        features.push(feature);
      });
      if (features.length > 0) {
        // TODO populate and show the form
        $('#formDiv').fadeTo(50,1,function(){
          // Form reset
          // Source: http://jquery-howto.blogspot.com.au/2013/08/jquery-form-reset.html
          $('form')[0].reset();

          // Displaying attribute info
          clickedFeature = features[0];
          $('#htitle').html(clickedFeature.get(featNameAttr));

          // Show the form
          $('#formDiv').show();
        });
      }
    });

    // Changing style on map moveend
    map.on('moveend', function(evt) {
      var c = map.getView().getCenter();
      console.log('Center: '+c[0]+','+c[1]);

      if (c[0] != 0 && c[1] != 0)
      {
        var closestFeature = vectorLayer.getSource().getClosestFeatureToCoordinate(c);
        if (closestFeature)
        {
          if (closestFeature.get(featNameAttr) != prevFeature.get(featNameAttr))
          {
            // Resetting the style of the previously selected feature
            if (prevFeature) {prevFeature.setStyle(styleOff);}
            // Styling the closest feature
            closestFeature.setStyle(styleOn(closestFeature));
            // Memorising feature for next style reset
            prevFeature = closestFeature;
          }        
        }
      }
    });

    // Build the form based on retrieved interface elements
    var buildForm = function(cfg){
      // Locating the form
      var f = $('form');
      var div_elt;

      //<div class="page-header">
      //  <h1>Example page header <small>Subtext for header</small></h1>
      //</div>
      var h1_elt = $('<h3>').attr('id','htitle');
      var header_elt = $('<div>')
                    .attr('class','text-left')
                    .css('color','black')
                    .append(h1_elt);
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
                          .html(cfg[k].key);
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
                          );
          var div_s3 = $('<div>')
                          .attr('id','photo_div_container')
                          .css({
                          })
                          .append(
                            $('<img>')
                            .attr('src', 'img/e.png')
                            .css({
                              width: '80px',
                              cursor: 'pointer'
                            })
                          );                          
          div_elt.append(div_s1).append(div_s2).append(div_s3);
          var img_elt = $('<img>').attr('id', 'thumb').attr('width',200);
          var img_progress = $('<p>').append($('<span>'));
          div_elt.append(img_elt).append(img_progress);
        }

        // <input type="text" class="form-control" placeholder="Text input">
        if (cfg[k].type == "persistent_text")
        {
          div_elt = $('<div>').attr('class', 'form-group');
          var div_s1 = $('<label>')
                          .attr('for', 'text_input')
                          .html(cfg[k].key);
          var div_s2 = $('<input>')
                          .attr('type', 'text')
                          .attr('id', 'text_input');
          div_elt.append(div_s1).append(div_s2);
        }

        // Appending the div to the form
        f.append(div_elt);
      }

      // Click on photo img container should trigger the input file 'click' event 
      $('#photo_div_container').on('click',function(){
        $('input[name=photo_input]').trigger('click');
      });

      // When file changed, we resize it client-side
      $('input[name=photo_input]').change(function(e) {
        var file = e.target.files[0];
        canvasResize(file, {
          width: 800,
          height: 0,
          crop: false,
          quality: 80,
          //rotate: 90,
          callback: function(data, width, height) {
            $('#thumb').attr('src', data);
          }
        });
      });

      // Adding the close button
      var b1 = $('<button>').attr('type','button')
            .css({
              'position':'absolute',
              'bottom': 0,
              'left': 0,
              'margin-bottom': '10px',
              'margin-left': '20px'
            })
            .attr('class','btn btn-default')
            .html('Cancel')
            .on('click',function(){
              $('#formDiv').fadeTo(150,0,function(){
                $('#formDiv').hide();
                clickedFeature = null;
              });
            });
      f.append(b1);

      // Adding the buttons
      var b2 = $('<button>')
        .attr('type','button')
        .css({
          'position':'absolute',
          'bottom': 0,
          'right': 0,
          'margin-bottom': '10px',
          'margin-right': '20px'
        })
        .attr('class','btn btn-default')
        .html('Upload')
        .on('click',function(){
          // TODO: loader indicating file is being uploaded
          console.log('Submitting form');

          // Create a new formdata
          var fd = new FormData();

          // Photo input
          fd.append("photo_input", $.canvasResize('dataURLtoBlob', $('#thumb').attr('src')));

          // Serialize will skip file input
          var other_data = $('form').serializeArray();
          $.each(other_data,function(key,input){
              fd.append(input.name,input.value);
          });

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
                  $('p span').css({
                      'width': loaded + "%"
                  }).html(loaded + "%");
                }
              }, false);
              return xhr;
            }
          }).done(function(response) {
            console.log(response);
            if (response.url_imgur) {
              // All good - hide the form
              $('#formDiv').fadeTo(150,0,function(){
                if (getUrlParameter('mode')=='raw')
                {
                  alert(JSON.stringify(response));
                }                
                $('#formDiv').hide();
                clickedFeature = null;
              });
            }
          });
        });
      f.append(b2);
    }

    // Instantiating the form building
    buildForm(cfg2[0].rows);

  }
});

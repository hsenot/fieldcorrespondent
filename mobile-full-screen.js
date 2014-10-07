// Project number
var proj_num = 1; 

// Promise to execute the map initialisation when all config AJAX calls have been fulfilled
$.when( 
  // Project specific information
  $.ajax({
    url: "http://groundtruth.cartodb.com/api/v2/sql?q=SELECT * FROM public.fc_projects WHERE project_id='"+ proj_num +"'"
  }), 
  // Form structure
  $.ajax({
    url: "http://groundtruth.cartodb.com/api/v2/sql?q=SELECT * FROM public.fc_interface_element WHERE project_id='"+ proj_num +"' ORDER BY cartodb_id"
  }) 
).done(function( a1, a2 ) {
  // a1 and a2 are arguments resolved for the page1 and page2 ajax requests, respectively.
  // Each argument is an array with the following structure: [ data, statusText, jqXHR ]
  initMap(a1,a2);
});

var initMap = function(cfg1,cfg2) {

  // TODO set center (and possibly zoom) for initial view
  if (cfg1[0].rows[0].the_geom)
  {
    alert("Initial view info detected.");
  }

  var view = new ol.View({
    center: [0, 0],
    zoom: 2
  });

  var styleOff = new ol.style.Style({
    image: new ol.style.Icon(/** @type {olx.style.IconOptions} */ ({
      anchor: [0.5, 37],
      anchorXUnits: 'fraction',
      anchorYUnits: 'pixels',
      opacity: 0.90,
      src: 'img/photo.png'
    }))
  });

  var styleOn = new ol.style.Style({
    image: new ol.style.Icon(/** @type {olx.style.IconOptions} */ ({
      anchor: [0.5, 37],
      anchorXUnits: 'fraction',
      anchorYUnits: 'pixels',
      opacity: 0.90,
      src: 'img/photo_on.png'
    }))
  });

  var vectorLayer = new ol.layer.Vector({
    source: new ol.source.GeoJSON({
      url: "https://groundtruth.cartodb.com/api/v2/sql?filename=fc_features&q=SELECT+title,ST_Centroid(the_geom)+the_geom+FROM+public.fc_features&format=geojson",
      projection: 'EPSG:3857'
    }),
    style: styleOff
  });

  vectorLayer.on('precompose', function(event) {
    var ctx = event.context;
    var pixelRatio = event.frameState.pixelRatio;
    var w = ctx.canvas.width, h = ctx.canvas.height;
    var lens_size = 200;

    ctx.save();
    ctx.beginPath();
    // only show a circle around the mouse
    ctx.arc(w/2 , h/2 , lens_size  * pixelRatio, 0, 2 * Math.PI);

    ctx.lineWidth = 5 * pixelRatio;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.stroke();
    ctx.clip();

    var grd=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,lens_size); 
    var opacity = 0.25; //55% visible
    grd.addColorStop(0,'transparent');
    grd.addColorStop(1,'rgba(31,0,0,'+opacity+')');
    ctx.fillStyle=grd;
    ctx.fill();

  });

  vectorLayer.on('postcompose', function(event) {
    var ctx = event.context;
    ctx.restore();
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

  // Geolocation
  var geolocation = new ol.Geolocation({
    projection: view.getProjection(),
    tracking: true
  });
  geolocation.once('change:position', function() {
    view.setCenter(geolocation.getPosition());
    view.setResolution(2.388657133911758);
  });

  // Popup on marker
  // select interaction working on "singleclick"
  var selectSingleClick = new ol.interaction.Select({
    condition: ol.events.condition.click,
    style: styleOn
  });
  map.addInteraction(selectSingleClick);

  var myListener = function(e){
    var el = e.element;
    if (e.type === "add")
    {
      //alert(el.get('title')+' has been pressed.');
      // TODO populate and show the form
      $('#formDiv').fadeTo(150,1,function(){
        $('#formDiv').show();
      });
    }
  };

  var collection = selectSingleClick.getFeatures(); 
  collection.on('add', myListener); 
  collection.on('remove', myListener); 

  // Build the form based on retrieved interface elements
  var buildForm = function(cfg){
    // Locating the form
    var f = $('form');
    var div_elt;

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
        var div_s2 = $('<input>')
                        .attr('type', 'file')
                        .attr('id', 'photo_input');
        div_elt.append(div_s1).append(div_s2);
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
                                  // TODO: clear the fields for the next feature clicked
                                });
                              });
    f.append(b1);

    // Adding the buttons
    var b2 = $('<button>').attr('type','button')
                              .css({
                                'position':'absolute',
                                'bottom': 0,
                                'right': 0,
                                'margin-bottom': '10px',
                                'margin-right': '20px'
                              })
                              .attr('class','btn btn-default')
                              .html('Submit')
                              .on('click',function(){
                                alert('Submitting');
                                $('#formDiv').fadeTo(150,0,function(){
                                  $('#formDiv').hide();
                                  // TODO: submit to PHP service
                                });
                              });
    f.append(b2);
  }

  // Instantiating the form building
  buildForm(cfg2[0].rows);

}


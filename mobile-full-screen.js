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
    new ol.layer.Vector({
      source: new ol.source.GeoJSON({
        url: "https://groundtruth.cartodb.com/api/v2/sql?filename=fc_features&q=SELECT+title,ST_Centroid(the_geom)+the_geom+FROM+public.fc_features&format=geojson",
        projection: 'EPSG:3857'
      }),
      style: styleOff
    })
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
    alert(el.get('title')+' has been pressed.');
  }
};

var collection = selectSingleClick.getFeatures(); 
collection.on('add', myListener); 
collection.on('remove', myListener); 

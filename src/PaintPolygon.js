//import L from 'leaflet';
import turf from './myTurf.js';
import canvg from 'canvg';
// import './html2canvas.min.js';
import html2canvas from 'html2canvas';
import leafletImage from 'leaflet-image';
import './PaintPolygon.css';

('use strict');
const PaintPolygon = L.Control.extend({
  options: {
    position: 'topright',
    radius: 30,
    minRadius: 10,
    maxRadius: 50,
    layerOptions: {
      interactive: false, // if this is true, when touching over existing drawing, it will trigger map pan or pull-to-refresh of android
    },
    layerEraseOptions: {
      interactive: false, // if this is true, when touching over existing drawing, it will trigger map pan or pull-to-refresh of android
      color: '#ff324a',
    },
    drawOptions: {
      weight: 1,
      interactive: false, // if this is true, when touching over existing drawer circle, it will trigger map pan or pull-to-refresh of android
    },
    eraseOptions: {
      color: '#ff324a',
      weight: 1,
      interactive: false, // if this is true, when touching over existing eraser circle, it will trigger map pan or pull-to-refresh of android
    },
    menu: {
      drawErase: true,
      size: true,
      eraseAll: true,
      capture: true,
      savgeAll: true,
      load: true,
      setting: true,
    },
  },

  _latlng: [0, 0],
  _metersPerPixel: {},

  onAdd: function (map) {
    this._map = map;
    this.setRadius(this.options.radius);

    if (this.options.menu === false) {
      return L.DomUtil.create('div');
    }

    this._container = L.DomUtil.create('div', 'leaflet-control-paintpolygon leaflet-bar leaflet-control');
    this._createMenu();
    this._circle = L.circleMarker(this._latlng, this.options.drawOptions).setRadius(this._radius).addTo(this._map);
    this.getCanvasXY();
    this._allData = null;
    this._isPerformance = false;

    return this._container;
  },

  onRemove: function () {
    this._map.off('mousemove', this._onMouseMove, this);
  },

  setRadius: function (radius) {
    if (radius !== undefined) {
      if (radius < this.options.minRadius) {
        this._radius = this.options.minRadius;
      } else if (radius > this.options.maxRadius) {
        this._radius = this.options.maxRadius;
      } else {
        this._radius = radius;
      }
    }
    if (this._circle) {
      this._circle.setRadius(this._radius);
    }
  },
  setPerformance: function () {
    this._isPerformance = !this._isPerformance;
  },
  startDraw: function () {
    this.stop();
    this._action = 'draw';
    this._addMouseListener();
    this._circle = L.circleMarker(this._latlng, this.options.drawOptions).setRadius(this._radius).addTo(this._map);
  },
  startErase: function () {
    this.stop();
    this._action = 'erase';
    this._addMouseListener();
    this._circle = L.circleMarker(this._latlng, this.options.eraseOptions).setRadius(this._radius).addTo(this._map);
  },
  stop: function () {
    this._action = null;
    if (this._circle) {
      this._circle.remove();
    }
    this._removeMouseListener();
  },
  getLayer: function () {
    return this._layer;
  },
  setData: function (data) {
    this._allData = data;
    if (this._oldLayer !== undefined) {
      this._oldLayer.remove();
    }
    this._oldLayer = L.geoJSON(this._allData, this.options.layerOptions).addTo(this._map);
  },
  setNewData: function (data) {
    this._newData = data;
    if (this._action == 'draw') {
      if (this._layer !== undefined) {
        this._layer.remove();
      }
      this._layer = L.geoJSON(this._newData, this.options.layerOptions).addTo(this._map);
    } else {
      if (this._eraseLayer !== undefined) {
        this._eraseLayer.remove();
      }
      this._eraseLayer = L.geoJSON(this._newData, this.options.layerEraseOptions).addTo(this._map);
    }
  },
  setAllData: function () {
    if (this._allData) {
      let fc = {
        type: 'FeatureCollection',
        features: [this._allData, this._newData],
      };
      try {
        if (this._action == 'draw') {
          this._allData = turf.union(fc);
        }
        if (this._action == 'erase') {
          this._allData = turf.difference(this._allData, this._newData);
        }
      } catch (err) {
        console.log(err);
      }
    } else this._allData = this._newData;

    if (this._oldLayer !== undefined) this._oldLayer.remove();
    if (this._eraseLayer !== undefined) this._eraseLayer.remove();
    if (this._layer !== undefined) this._layer.remove();

    this._oldLayer = L.geoJSON(this._allData, this.options.layerOptions).addTo(this._map);
  },
  getData: function () {
    return this._newData;
  },
  getCanvasXY: function () {
    var svg = this._map.getContainer().querySelectorAll('svg')[0];
    let { x, y, width, height } = svg.viewBox.baseVal;
    this._canvasX = x;
    this._canvasY = y;
  },
  eraseAll: function () {
    this._allData = null;
    this.setAllData();
  },
  capture: async function () {
    var w = this._map.getContainer().clientWidth;
    var h = this._map.getContainer().clientHeight;
    var svg = this._map.getContainer().querySelectorAll('svg')[0].cloneNode(true);
    var viewDrawed = document.createElement('div');
    var offsetX = (this._map.getContainer().querySelectorAll('svg')[0].clientWidth - w) / 2;
    var offsetY = (this._map.getContainer().querySelectorAll('svg')[0].clientHeight - h) / 2;

    svg.style.transform = 'translate(-' + offsetX + 'px, -' + offsetY + 'px)';

    viewDrawed.style.width = w + 'px';
    viewDrawed.style.height = h + 'px';
    viewDrawed.style.overflow = 'hidden';
    viewDrawed.appendChild(svg);

    var c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    var v = await canvg.from(ctx, viewDrawed.outerHTML);
    v.start();

    const mapDiv = this._map;
    mapDiv.getContainer().querySelectorAll('svg')[0].style.display = 'none';

    const promise = new Promise(function (resolve, reject) {
      leafletImage(mapDiv, function (err, canvas) {
        mapDiv.getContainer().querySelectorAll('svg')[0].style.display = '';
        canvas.getContext('2d').drawImage(c, 0, 0);
        var a = document.createElement('a');
        a.href = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
        a.download = 'map.png';
        a.click();
        c.remove();

        resolve(a.href);
      });
    });

    const dataURL = await promise;
  },
  saveAll: function () {
    let data = JSON.stringify(this._allData);

    // Convert the text to BLOB.
    const textToBLOB = new Blob([data], { type: 'text/plain' });
    const sFileName = 'map.json'; // The file to save the data.

    let newLink = document.createElement('a');
    newLink.download = sFileName;

    if (window.webkitURL != null) {
      newLink.href = window.webkitURL.createObjectURL(textToBLOB);
    } else {
      newLink.href = window.URL.createObjectURL(textToBLOB);
      newLink.style.display = 'none';
      document.body.appendChild(newLink);
    }

    newLink.click();
  },

  /////////////////////////
  // Menu creation and click callback
  _createMenu: function () {
    if (this.options.menu.drawErase !== false) {
      this._iconDraw = L.DomUtil.create('a', 'leaflet-control-paintpolygon-icon leaflet-control-paintpolygon-icon-brush', this._container);
      this._iconErase = L.DomUtil.create('a', 'leaflet-control-paintpolygon-icon leaflet-control-paintpolygon-icon-eraser', this._container);
      L.DomEvent.on(this._iconDraw, 'click mousedown', this._clickDraw, this);
      L.DomEvent.on(this._iconErase, 'click mousedown', this._clickErase, this);
    }

    if (this.options.menu.size !== false) {
      this._iconSize = L.DomUtil.create('a', 'leaflet-control-paintpolygon-icon leaflet-control-paintpolygon-icon-size', this._container);

      this._menu = L.DomUtil.create('div', 'leaflet-bar leaflet-control-paintpolygon-menu', this._container);
      L.DomEvent.disableClickPropagation(this._menu);

      var menuContent = L.DomUtil.create('div', 'leaflet-control-paintpolygon-menu-content', this._menu);
      var cursor = L.DomUtil.create('input', '', menuContent);
      cursor.type = 'range';
      cursor.value = this._radius;
      cursor.min = this.options.minRadius;
      cursor.max = this.options.maxRadius;

      L.DomEvent.on(cursor, 'input change', this._cursorMove, this);
      L.DomEvent.on(this._iconSize, 'click mousedown', this._clickSize, this);
    }

    if (this.options.menu.eraseAll !== false) {
      this._iconEraseAll = L.DomUtil.create('a', 'leaflet-control-paintpolygon-icon leaflet-control-paintpolygon-icon-trash', this._container);
      L.DomEvent.on(this._iconEraseAll, 'click mousedown', this._clickEraseAll, this);
    }
    if (this.options.menu.capture !== false) {
      this._iconCapture = L.DomUtil.create(
        'a',
        'leaflet-control-paintpolygon-icon-capture leaflet-control-paintpolygon-icon-capture-save-load',
        this._container
      );
      L.DomEvent.on(this._iconCapture, 'click mousedown', this._clickCapture, this);
    }
    if (this.options.menu.saveAll !== false) {
      this._iconSaveAll = L.DomUtil.create('a', 'leaflet-control-paintpolygon-icon-save', this._container);
      L.DomEvent.on(this._iconSaveAll, 'click mousedown', this._clickSaveAll, this);
    }
    if (this.options.menu.load !== false) {
      this._iconLoad = L.DomUtil.create(
        'div',
        'leaflet-control-paintpolygon-load leaflet-control-paintpolygon-icon-capture-save-load',
        this._container
      );
      var imageUpload = L.DomUtil.create('div', 'image-load', this._iconLoad);
      var inputLabel = L.DomUtil.create('label', 'input-label', imageUpload);
      inputLabel.setAttribute('for', 'file-input');
      var iconImg = L.DomUtil.create('a', 'leaflet-control-paintpolygon-icon-load', inputLabel);
      var fileInput = L.DomUtil.create('input', '', imageUpload);
      fileInput.setAttribute('id', 'file-input');
      fileInput.setAttribute('accept', '.json');
      fileInput.setAttribute('type', 'file');
      L.DomEvent.on(fileInput, 'input click', this._clickLoadMap, this);
    }
    if (this.options.menu.setting !== false) {
      this._iconSetting = L.DomUtil.create('a', 'leaflet-control-paintpolygon-icon leaflet-control-paintpolygon-icon-setting', this._container);

      this._settingContent = L.DomUtil.create('div', 'leaflet-bar leaflet-control-paintpolygon-setting', this._container);
      L.DomEvent.disableClickPropagation(this._settingContent);

      var menuContent = L.DomUtil.create('div', 'leaflet-control-paintpolygon-menu-content', this._settingContent);
      var checkbox = L.DomUtil.create('input', '', menuContent);
      menuContent.style.display = 'flex';
      checkbox.type = 'checkbox';
      checkbox.value = this._radius;
      checkbox.min = this.options.minRadius;
      checkbox.max = this.options.maxRadius;
      var label = L.DomUtil.create('label', '', menuContent);
      label.innerHTML = 'Performance';

      L.DomEvent.on(checkbox, 'input', this._improvePerformance, this);
      L.DomEvent.on(this._iconSetting, 'click mousedown', this._clickSetting, this);
    }
  },

  _clickDraw: function (evt) {
    if (evt.type == 'mousedown') {
      L.DomEvent.stop(evt);
      return;
    }
    this._resetMenu();
    if (this._action == 'draw') {
      this.stop();
    } else {
      this.startDraw();
      this._activeIconStyle(this._iconDraw);
    }
  },
  _clickErase: function (evt) {
    if (evt.type == 'mousedown') {
      L.DomEvent.stop(evt);
      return;
    }
    this._resetMenu();
    if (this._action == 'erase') {
      this.stop();
    } else {
      this.startErase();
      this._activeIconStyle(this._iconErase);
    }
  },
  _clickSize: function (evt) {
    if (evt.type == 'mousedown') {
      L.DomEvent.stop(evt);
      return;
    }
    if (L.DomUtil.hasClass(this._menu, 'leaflet-control-paintpolygon-menu-open')) {
      this._closeMenu(this._menu);
    } else {
      this._openMenu(this._menu);
    }
  },

  _clickSetting: function (evt) {
    if (evt.type == 'mousedown') {
      this.stop();
      this._resetMenu();
      L.DomEvent.stop(evt);
      return;
    }
    if (L.DomUtil.hasClass(this._settingContent, 'leaflet-control-paintpolygon-menu-open')) {
      this._closeMenu(this._settingContent);
    } else {
      this._openMenu(this._settingContent);
    }
  },

  _clickEraseAll: function (evt) {
    if (evt.type == 'mousedown') {
      L.DomEvent.stop(evt);
      return;
    }
    this.eraseAll();
  },
  _clickCapture: function (evt) {
    if (evt.type == 'mousedown') {
      this.stop();
      this._resetMenu();
      L.DomEvent.stop(evt);
      return;
    }
    this.capture();
  },
  _clickSaveAll: function (evt) {
    if (evt.type == 'mousedown') {
      L.DomEvent.stop(evt);
      return;
    }
    this.saveAll();
  },
  _clickLoadMap: function (evt) {
    if (evt.type == 'click') {
      this.stop();
      this._resetMenu();
      evt.target.value = null;
      return;
    }
    try {
      let files = evt.target.files;
      let file = files[0];
      let reader = new FileReader();
      const self = this;
      reader.onload = (event) => {
        this._allData = null;
        this._newData = JSON.parse(event.target.result);
        this.setAllData(this._newData);
        this._newData = null;
      };
      reader.readAsText(file);
    } catch (err) {
      console.error(err);
    }
  },
  _resetMenu: function () {
    L.DomUtil.removeClass(this._iconDraw, 'leaflet-control-paintpolygon-icon-active');
    L.DomUtil.removeClass(this._iconErase, 'leaflet-control-paintpolygon-icon-active');
  },
  _activeIconStyle: function (icon) {
    L.DomUtil.addClass(icon, 'leaflet-control-paintpolygon-icon-active');
  },
  _openMenu: function (menu) {
    L.DomUtil.addClass(menu, 'leaflet-control-paintpolygon-menu-open');
  },
  _closeMenu: function (menu) {
    L.DomUtil.removeClass(menu, 'leaflet-control-paintpolygon-menu-open');
  },
  _cursorMove: function (evt) {
    this.setRadius(evt.target.valueAsNumber);
  },
  _improvePerformance: function (evt) {
    this.setPerformance();
  },

  /////////////////

  ////////////////
  // Map events

  _addMouseListener: function () {
    if (L.Browser.mobile) {
      console.log('mobile');
      const mapDiv = this._map.getContainer();
      L.DomEvent.addListener(mapDiv, 'touchstart', this._onTouchStart, this);
      L.DomEvent.addListener(mapDiv, 'touchmove', this._onTouchMove, this);
      L.DomEvent.addListener(mapDiv, 'touchend', this._onTouchEnd, this);
    } else {
      console.log('desktop');
      this._map.on('mousemove', this._onMouseMove, this);
      this._map.on('mousedown', this._onMouseDown, this);
      this._map.on('mouseup', this._onMouseUp, this);
    }
  },
  _removeMouseListener: function () {
    if (L.Browser.mobile) {
      const mapDiv = this._map.getContainer();
      L.DomEvent.removeListener(mapDiv, 'touchstart', this._onTouchStart, this);
      L.DomEvent.removeListener(mapDiv, 'touchmove', this._onTouchMove, this);
      L.DomEvent.removeListener(mapDiv, 'touchend', this._onTouchEnd, this);
    } else {
      this._map.off('mousemove', this._onMouseMove, this);
      this._map.off('mousedown', this._onMouseDown, this);
      this._map.off('mouseup', this._onMouseUp, this);
    }
  },
  _onMouseDown: function (evt) {
    this._map.dragging.disable();
    this._mousedown = true;
    this._onMouseMove(evt);
  },
  _onMouseMove: function (evt) {
    this._setLatLng(evt.latlng);
    if (this._mousedown === true) {
      this._stackEvt(evt.latlng, this._map.getZoom(), this._radius, this._action);
    }
  },
  _onMouseUp: function (evt) {
    if (this._newData !== null && this._isPerformance) {
      this.setAllData();
      this._newData = null;
    }
    this._map.dragging.enable();
    this._mousedown = false;
  },

  _onTouchStart: function (evt) {
    L.DomEvent.stop(evt); // Very important to prevent dragging and panning the map
    const mapDiv = this._map.getContainer();
    if (evt.target !== mapDiv) return; // to prevent drawing when dragging overlay marker or so

    this._mousedown = true;
    this._onTouchMove(evt);
  },
  _onTouchMove: function (evt) {
    L.DomEvent.stop(evt); // Very important to prevent dragging and panning the map
    const mapDiv = this._map.getContainer();
    if (evt.target !== mapDiv) return; // to prevent drawing when dragging overlay marker or so

    const latlng = this._map.mouseEventToLatLng(evt.touches.pop());
    this._setLatLng(latlng);
    if (this._mousedown === true) {
      this._stackEvt(latlng, this._map.getZoom(), this._radius, this._action);
    }
  },
  _onTouchEnd: function (evt) {
    L.DomEvent.stop(evt); // Very important to prevent dragging and panning the map
    if (this._newData !== null && this._isPerformance) {
      this.setAllData();
      this._newData = null;
    }
    this._mousedown = false;
  },

  ////////////////

  _setLatLng: function (latlng) {
    if (latlng !== undefined) {
      this._latlng = latlng;
    }
    if (this._circle) {
      this._circle.setLatLng(this._latlng);
    }
  },

  _latLngAsGeoJSON: function (latlng) {
    return {
      type: 'Point',
      coordinates: [latlng.lng, latlng.lat],
    };
  },

  _getCircleAsPolygon: function (latlng, zoom, radius) {
    var lat = latlng.lat;

    if (this._metersPerPixel[zoom] === undefined) {
      this._metersPerPixel[zoom] = (40075016.686 * Math.abs(Math.cos((lat * Math.PI) / 180))) / Math.pow(2, zoom + 8);
    }

    let circle = null;
    try {
      circle = turf.circle(this._latLngAsGeoJSON(latlng), (this._metersPerPixel[zoom] * radius) / 1000, {
        //steps: 128
      });
    } catch (err) {
      console.log(err);
    }

    return circle;
  },

  _draw: function (latlng, zoom, radius) {
    if (!this._allData) {
      this.setData(this._getCircleAsPolygon(latlng, zoom, radius));
    } else {
      let fc = {
        type: 'FeatureCollection',
        features: [this._allData, this._getCircleAsPolygon(latlng, zoom, radius)],
      };

      try {
        this.setData(turf.union(fc));
      } catch (err) {
        console.log(err);
      }
    }
  },

  _drawPerformance: function (latlng, zoom, radius) {
    if (!this._newData) {
      this.setNewData(this._getCircleAsPolygon(latlng, zoom, radius));
    } else {
      let fc = {
        type: 'FeatureCollection',
        features: [this._newData, this._getCircleAsPolygon(latlng, zoom, radius)],
      };

      try {
        this.setNewData(turf.union(fc));
      } catch (err) {
        console.log(err);
      }
    }
  },

  _erase: function (latlng, zoom, radius) {
    if (this._allData === undefined || this._allData === null) {
      return;
    } else {
      try {
        this.setData(turf.difference(this._allData, this._getCircleAsPolygon(latlng, zoom, radius)));
      } catch (err) {
        console.log(err);
      }
    }
  },

  _erasePerformance: function (latlng, zoom, radius) {
    if (this._allData !== null) {
      this._drawPerformance(latlng, zoom, radius);
    }
  },

  _stackEvt: function (latlng, zoom, radius, action) {
    if (this._stack === undefined) {
      this._stack = new Array();
    }

    this._stack.push({
      latlng: latlng,
      zoom: zoom,
      radius: radius,
      action: action,
    });
    this._processStack();
  },

  _processStack: function () {
    if (this._processingStack === true || this._stack.length == 0) {
      return;
    }
    this._processingStack = true;

    var evt = this._stack.shift();
    if (evt.action == 'draw') {
      if (this._isPerformance) {
        this._drawPerformance(evt.latlng, evt.zoom, evt.radius);
      } else this._draw(evt.latlng, evt.zoom, evt.radius);
    } else if (evt.action == 'erase') {
      if (this._isPerformance) {
        this._erasePerformance(evt.latlng, evt.zoom, evt.radius);
      } else this._erase(evt.latlng, evt.zoom, evt.radius);
    }

    this._processingStack = false;
    this._processStack();
  },
});

L.Control.PaintPolygon = PaintPolygon;
L.control.paintPolygon = (options) => new L.Control.PaintPolygon(options);

export default PaintPolygon;
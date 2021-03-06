import {Layer} from '../Layer';
import * as DomUtil from '../../dom/DomUtil';
import * as Util from '../../core/Util';
import * as Browser from '../../core/Browser';
import {Bounds} from '../../geometry/Bounds';



/*
 * @class Renderer
 * @inherits Layer
 * @aka L.Renderer
 *
 * Base class for vector renderer implementations (`SVG`, `Canvas`). Handles the
 * DOM container of the renderer, its bounds, and its zoom animation.
 *
 * A `Renderer` works as an implicit layer group for all `Path`s - the renderer
 * itself can be added or removed to the map. All paths use a renderer, which can
 * be implicit (the map will decide the type of renderer and use it automatically)
 * or explicit (using the [`renderer`](#path-renderer) option of the path).
 *
 * Do not use this class directly, use `SVG` and `Canvas` instead.
 *
 * @event update: Event
 * Fired when the renderer updates its bounds, center and zoom, for example when
 * its map has moved
 */

export var Renderer = Layer.extend({

	// @section
	// @aka Renderer options
	options: {
		// @option padding: Number = 0.1
		// How much to extend the clip area around the map view (relative to its size)
		// e.g. 0.1 would be 10% of map view in each direction
		padding: 0.1,

		// @option tolerance: Number = 0
		// How much to extend click tolerance round a path/object on the map
		tolerance : 0
	},

	initialize: function (options) {
		Util.setOptions(this, options);
		Util.stamp(this);
		this._layers = this._layers || {};
	},

	onAdd: function (map) {
		if (!this._container) {
			this._initContainer(); // defined by renderer implementations

			if (this._zoomAnimated) {
				DomUtil.addClass(this._container, 'leaflet-zoom-animated');
			}
		}

		this.getPane().appendChild(this._container);
		this._update();
		this.on('update', this._updatePaths, this);
		this._map.on('rotate', this._update, this);
	},

	onRemove: function () {
		this.off('update', this._updatePaths, this);
		this._destroyContainer();
		this._map.off('rotate', this._update, this);
	},

	getEvents: function () {
		var events = {
			viewreset: this._reset,
			zoom: this._onZoom,
			moveend: this._update,
			zoomend: this._onZoomEnd
		};
		if (this._zoomAnimated) {
			events.zoomanim = this._onAnimZoom;
		}
		return events;
	},

	_onAnimZoom: function (ev) {
		this._updateTransform(ev.center, ev.zoom);
	},

	_onZoom: function () {
		this._updateTransform(this._map.getCenter(), this._map.getZoom());
	},

	_updateTransform: function (center, zoom) {
		var scale = this._map.getZoomScale(zoom, this._zoom),
		    offset = this._map._latLngToNewLayerPoint(this._topLeft, zoom, center);
		if (Browser.any3d) {
			DomUtil.setTransform(this._container, offset, scale);
		} else {
			DomUtil.setPosition(this._container, offset);
		}
	},

	_reset: function () {
		this._update();
		this._updateTransform(this._center, this._zoom);

		for (var id in this._layers) {
			this._layers[id]._reset();
		}
	},

	_onZoomEnd: function () {
		for (var id in this._layers) {
			this._layers[id]._project();
		}
	},

	_updatePaths: function () {
		for (var id in this._layers) {
			this._layers[id]._update();
		}
	},

	_update: function () {
		// Update pixel bounds of renderer container (for positioning/sizing/clipping later)
		// Subclasses are responsible of firing the 'update' event.
		var p = this.options.padding,
		    map = this._map,
		    size = this._map.getSize(),
		    padMin = size.multiplyBy(-p),
		    padMax = size.multiplyBy(1 + p),
		    //// TODO: Somehow refactor this out into map.something() - the code is
		    ////   pretty much the same as in GridLayer.
		    clip = new L.Bounds([
			    map.containerPointToLayerPoint([padMin.x, padMin.y]).floor(),
			    map.containerPointToLayerPoint([padMin.x, padMax.y]).floor(),
			    map.containerPointToLayerPoint([padMax.x, padMin.y]).floor(),
			    map.containerPointToLayerPoint([padMax.x, padMax.y]).floor()
		    ]);
		//min = this._map.containerPointToLayerPoint(size.multiplyBy(-p)).round();

		this._bounds = clip;
		this._topLeft = this._map.layerPointToLatLng(clip.min);

		this._center = this._map.getCenter();
		this._zoom = this._map.getZoom();
	}
});

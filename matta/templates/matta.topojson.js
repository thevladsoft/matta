
var map_width = _width;
var map_height = _height;

var map_container = null;
var legend_container;
var threshold_container;
var path_g;
var mark_g;
var projection;
var graph_g;

if (_feature_name == null) {
    _feature_name = d3.keys(_data_geometry.objects)[0];
}

var geometry = topojson.feature(_data_geometry, _data_geometry.objects[_feature_name]);
console.log('geometry', geometry);

var available_ids = d3.set();
geometry.features.forEach(function(d) {
    available_ids.add(d[_feature_id]);
});

console.log('available ids', available_ids);

var path = d3.geo.path();

var legend = matta.symbol_legend()
    .position({x: 20 + _mark_max_ratio, y: _height - 20 });
var threshold_legend = matta.color_thresholds()
        .extent(_area_color_scale_extent)
        .width(_area_color_scale_width)
        .height(_area_color_scale_height)
        .title(_area_color_scale_title != null ? _area_color_scale_title : _area_value);

var threshold = d3.scale.threshold()
    .domain(_area_color_scale_domain)
    .range(_area_color_scale_range);

//console.log('area colors', area_color_thresholds);
console.log('threshold', threshold.range(), threshold.domain());


var draw_topojson = function() {
    console.log('map container', map_container);
    var p = path_g.selectAll('path')
        .data(geometry.features, function(d, i) { return d[_feature_id]; });

    p.enter()
        .append('path');

    p.exit()
        .remove();

    p.attr({
            'd': path,
            'fill': _fill_color,
            'stroke': _path_stroke,
            'opacity': _path_opacity,
            'stroke-width': _path_stroke_width
        });

    if (_label != null) {
        var label = map_container.selectAll('text').data(geometry.features, function(d, i) { return d[_feature_id]; });

        label.enter()
            .append('text');

        label.attr({
                'x': function(d) { return path.centroid(d)[0]; },
                'y': function(d) { return path.centroid(d)[1]; },
                'font-size': _label_font_size,
                'fill': _label
            })
            .text(function(d) { return d.properties[_label]; });
    }

    console.log('dataframe', _data_area_dataframe, _data_mark_dataframe);

    if (_data_area_dataframe != null){
        var area_colors = d3.map();
        _data_area_dataframe.forEach(function(d) {
            if (_area_value != null && d.hasOwnProperty(_area_value)) {
                area_colors.set(d[_area_feature_name], threshold(d[_area_value]));
            }
        });

        console.log('area colors', area_colors);

        p.each(function(d) {
            if (area_colors.has(d[_feature_id])) {
                d3.select(this).attr({
                    'fill': area_colors.get(d[_feature_id]),
                    'opacity': _area_opacity
                });
            }
        });
        console.log('threshold', threshold);

        threshold_container.data([threshold]).call(threshold_legend);
    }

    if (_data_mark_dataframe != null) {
        var mark_positions = null;

        if (_mark_position) {
            mark_positions = d3.map();
            console.log('position_vars', _mark_position);
        }

        var marks = _data_mark_dataframe == null ? [] : _data_mark_dataframe.filter(function(d) {
            //console.log('symbol', _property_color, d.hasOwnProperty(_property_color), d);
            if (_mark_feature_name !== null) {
                console.log(d, d[_mark_feature_name], available_ids.has(d[_mark_feature_name]));
                return available_ids.has(d[_mark_feature_name]);
            }

            if (_mark_value != null) {
                return (d.hasOwnProperty(_mark_value));
            }

            if (_mark_position !== null) {
                return d.hasOwnProperty(_mark_position[0]) && d.hasOwnProperty(_mark_position[1]);
            }
            return false;
        });

        if (_mark_feature_name) {
            geometry.features.forEach(function(d) {
                mark_positions.set(d[_feature_id], path.centroid(d));
            });
        } else {
            console.log('projection', projection);
            marks.forEach(function(d, i) {
                {% if not options.leaflet %}
                var projected = projection([d[_mark_position[1]], d[_mark_position[0]]]);
                {% else %}
                var point = _map.latLngToLayerPoint(new _L.LatLng(d[_mark_position[0]], d[_mark_position[1]]))
                var projected = [point.x, point.y];
                {% endif %}
                mark_positions.set(i, projected);
            });
        }

        console.log('positions', mark_positions);

        var mark_scale = matta.scale(_mark_scale)
            .range([_mark_min_ratio, _mark_max_ratio])
            .domain(d3.extent(marks, function(d) { return d[_mark_value]; }));

        console.log('mark scale', _mark_scale, mark_scale.domain(), mark_scale.range());

        var legend_g = null;

        if (legend_container.select('g.axis').empty()) {
            legend_g = legend_container.append('g').classed('axis', true);
        } else {
            legend_g = legend_container.select('g.axis');
        }

        if (_legend === true) {
            legend_g.data([mark_scale]).call(legend);
        }

        var mark = mark_g.selectAll('circle.mark')
            .data(marks, function(d, i) {
                if (_mark_feature_name != null) {
                    return d[_mark_feature_name];
                }
                return i;
            });

        mark.enter()
            .append('circle')
            .attr('class', 'mark');

        mark.exit()
            .remove();

        mark.each(function(d, i) {
            if (_mark_feature_name != null) {
                d3.select(this).attr({
                    'cx': mark_positions.get(d[_mark_feature_name])[0],
                    'cy': mark_positions.get(d[_mark_feature_name])[1]
                });
            } else {
                d3.select(this).attr({
                    'cx': mark_positions.get(i)[0],
                    'cy': mark_positions.get(i)[1]
                });
            }

            if (_mark_color_property != null) {
                d3.select(this).attr({
                    'fill': d[_mark_color_property]
                });
            } else if (_mark_color != null) {
                d3.select(this).attr({
                    'fill': _mark_color
                });
            } else {
                 d3.select(this).attr({
                    'fill': 'none'
                });
            }
        });

        mark.attr({
            'r': function(d) { return mark_scale(d[_mark_value]); },
            'opacity': _mark_opacity,
            'stroke-width': _mark_stroke_width,
            'stroke': _mark_stroke
        });

        mark.sort(function(a, b) {
           return d3.descending(a[_mark_value], b[_mark_value]);
        });
    }

    if (_data_graph != null) {
        if (!_data_graph.hasOwnProperty('__matta_prepared__') || _data_graph['__matta_prepared__'] == false) {
            matta.prepare_graph(_data_graph);
            _data_graph['__matta_prepared__'] = true;
        }

        var node_positions = d3.map();
        _data_graph.nodes.forEach(function(d) {
                {% if not options.leaflet %}
                    var projected = projection([d[_mark_position[1]], d[_mark_position[0]]]);
                {% else %}
                    var point = _map.latLngToLayerPoint(new _L.LatLng(d[_mark_position[0]], d[_mark_position[1]]));
                    var projected = [point.x, point.y];
                {% endif %}
                node_positions.set(d.id, projected);
        });

        console.log('node positions', node_positions);

        var line = d3.svg.line()
            .x(function(d) { return node_positions.get(d.id)[0]; })
            .y(function(d) { return node_positions.get(d.id)[1]; });

        var node = graph_g.selectAll('circle.node')
            .data(_data_graph.nodes, function(d) { return d.id; });

        node.enter()
            .append('circle')
            .attr({
                'class': 'node',
                'r': 1.5,
                'fill': 'black',
                'opacity': 0.5
            });

        node.attr({
            'cx': function(d) { return node_positions.get(d.id)[0]; },
            'cy': function(d) { return node_positions.get(d.id)[1]; }
        });

        node.exit().remove();

        {% if options.graph_bundle_links %}
            if (!_data_graph.hasOwnProperty('bundled')) {
                // the bundling library requires x and y members in each node
                _data_graph.nodes.forEach(function(d) {
                    //var pos = node_positions.get(d.id);
                    //d.x = pos[0];
                    //d.y = pos[1];
                    d.x = d[_mark_position[0]];
                    d.y = d[_mark_position[1]];
                });

                var fbundling = force_edge_bundling()
                    .step_size(_force_edge_step_size)
                    .compatibility_threshold(_force_edge_compatibility_threshold)
                    .bundling_stiffness(_force_edge_bundling_stiffness)
                    .cycles(_force_edge_cycles)
                    .iterations(_force_edge_iterations)
                    .nodes(_data_graph.nodes)
                    .edges(_data_graph.links);

                _data_graph.bundled = fbundling();
            }

            _data_graph.bundled.forEach(function(bundle) {
                bundle.forEach(function(p) {
                    {% if not options.leaflet %}
                        var projected = projection([p.y, p.x]);
                    {% else %}
                        var point = _map.latLngToLayerPoint(new _L.LatLng(p.x, p.y));
                        var projected = [point.x, point.y];
                    {% endif %}
                    p.screen_x = projected[0];
                    p.screen_y = projected[1];
                });
            });

            console.log('bundle', _data_graph.bundled);

            line.interpolate("linear");
            console.log(_data_graph.bundled);
            var bundled_line = d3.svg.line()
                .x(function(d) { return d.screen_x; })
                .y(function(d) { return d.screen_y; });

            var link = graph_g.selectAll('path.link')
                    .data(_data_graph.bundled);

            link.enter()
                .append('path')
                .classed('link', true);

            link.attr({
                'd': bundled_line,
                'stroke': _link_color,
                'fill': 'none',
                'opacity': _link_opacity,
                'stroke-width': _link_width,
            });

            link.exit()
                .remove();
        {% else %}
            var link = graph_g.selectAll('path.link')
                .data(_data_graph.links);

            link.enter()
                .append('path')
                .classed('link', true);

            link.attr({
                    'd': function(d) {
                        var parts = [d.source, d.target];
                        return line(parts);
                    },
                    'stroke': _link_color,
                    'fill': 'none',
                    'opacity': _link_opacity,
                    'stroke-width': _link_width,
                });

            link.exit()
                .remove();
        {% endif %}
    }

};

!function() {
    {% if options.leaflet %}
        // code adapted from https://github.com/mbostock/bost.ocks.org/blob/gh-pages/mike/leaflet/index.html#L131-171
        if (_L == null) {
            _L = leaflet;
        }

        var map_initialized = false;
        var map_svg;
        var overlay_svg;

        if (container.select('div.leaflet-map-pane').empty()) {
            _map = _L.map(container.node()).setView([0, 0], 12);
            container.node()['__leaflet_map__'] = _map;
            _L.tileLayer(_leaflet_tile_layer, {attribution: _leaflet_map_link}).addTo(_map);
            map_initialized = true;
            map_svg = d3.select(_map.getPanes().overlayPane).append('svg');
            map_container = map_svg.append('g').attr('class', 'leaflet-zoom-hide');
        } else {
            map = container.node()['__leaflet_map__'];
            map_svg = d3.select(_map.getPanes().overlayPane).select('svg');
            map_container = map_svg.select('g.leaflet-zoom-hide');
        }

        if (!container.select('div.leaflet-top.leaflet-left').select('svg.overlay').empty()) {
            overlay_svg = container.select('div.leaflet-top.leaflet-left').select('svg.overlay');
        } else {
            overlay_svg = container.select('div.leaflet-top.leaflet-left')
                .append('svg').classed('overlay', true)
                .attr({'width': _width, 'height': _height})
                .style({'z-index': 1100, 'position': 'absolute', 'top': 0, 'left': 0});
        }

        path_g = map_container.select('g.geo-paths');

        if (path_g.empty()) {
            path_g = map_container.append('g').attr('class', 'geo-paths');
        }

        mark_g = map_container.select('g.marks');
        if (mark_g.empty()) {
            mark_g = map_container.append('g').attr('class', 'marks');
        }

        graph_g = map_container.select('g.graph');
        if (graph_g.empty()) {
            graph_g = map_container.append('g').attr('class', 'graph');
        }

        projection = d3.geo.transform({point: function(x, y) {
                var point = _map.latLngToLayerPoint(new _L.LatLng(y, x));
                this.stream.point(point.x, point.y);
            }
        });

        console.log('projection', projection);
        // Reposition the SVG to cover the features.
        var reset = function() {
            var bounds = path.bounds(geometry),
                topLeft = bounds[0],
                bottomRight = bounds[1];

            map_svg.attr("width", bottomRight[0] - topLeft[0])
                .attr("height", bottomRight[1] - topLeft[1])
                .style("left", topLeft[0] + "px")
                .style("top", topLeft[1] + "px");

            map_container.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");
            console.log('zoom', _map.getZoom(), _map.getMaxZoom());
            draw_topojson();
        };

        path.projection(d3.geo.transform());
        var map_bounds = path.bounds(geometry);
        path.projection(projection);
        console.log('bounds', map_bounds);

        if (map_initialized) {
            if (_bounding_box) {
                _map.fitBounds(_bounding_box.map(function(d) { return d.reverse(); }));
            } else {
                _map.fitBounds(map_bounds.map(function(d) { return d.reverse(); }));
            }
        }

        if (!overlay_svg.select('g.mark-legend').empty()) {
            legend_container = overlay_svg.select('g.mark-legend');
        } else {
            legend_container = overlay_svg.append('g').classed('mark-legend', true);
        }

        if (!overlay_svg.select('g.threshold-legend').empty()) {
            threshold_container = overlay_svg.select('g.threshold-legend');
        } else {
            threshold_container = overlay_svg.append('g').classed('threshold-legend', true);
        }

        console.log('threshold position', {x: map_width - _area_color_scale_width - 20, y: 20});
        threshold_legend.position({x: map_width - _area_color_scale_width - 20, y: 20});

        _map.on("viewreset", reset);
        reset();
    {% else %}
        map_container = container;
        if (_area_color_scale_domain != null && _area_color_scale_range) {
            map_height -= _area_color_scale_height + 50;
        }
        threshold_legend.position({x: (map_width - _area_color_scale_width) * 0.5, y: map_height });

        path_g = map_container.select('g.geo-paths');

        if (path_g.empty()) {
            path_g = map_container.append('g').attr('class', 'geo-paths');
        }

        mark_g = map_container.select('g.marks');
        if (mark_g.empty()) {
            mark_g = map_container.append('g').attr('class', 'marks');
        }

        graph_g = map_container.select('g.graph');
        if (graph_g.empty()) {
            graph_g = map_container.append('g').attr('class', 'graph');
        }

        if (!container.select('g.mark-legend').empty()) {
            legend_container = container.select('g.mark-legend');
        } else {
            legend_container = container.append('g').classed('mark-legend', true);
        }
        console.log('legend_container', legend_container);

        if (!container.select('g.threshold-legend').empty()) {
            threshold_container = container.select('g.threshold-legend');
        } else {
            threshold_container = container.append('g').classed('threshold-legend', true);
        }
        console.log('threshold_container', threshold_container);

        projection = d3.geo.mercator()
            .center([0,0])
            .scale(1)
            .translate([0, 0]);

        path.projection(projection);

        var st = matta.fit_projection(map_width, map_height, path.bounds(geometry));
        projection.scale(st[0]).translate(st[1]);
        draw_topojson();
    {% endif %}
}();
import _ from "lodash";
import * as d3 from "d3v4";

export const uuid = function () {
    var d = new Date().getTime();
    var uuid = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        function (c) {
            var r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c === "x" ? r : r && 0x7 | 0x8).toString(16);
        }
    );
    return uuid;
};

// Получение позиции из нескольких координат
// positions = [{
//     x: 0,
//     y: 0,
//     z: 0,
//     distance: 70,
// }, ...]
export const getPosition = function (
    positions = [],
    {
        // максимальное число итераций
        max_iter,
        // желаемая точность
        target_delta,
        // шаг (должен быть меньше точности)
        step,
        // определять лучшее направление каждую fq итерацию
        fq,
    } = {}
) {
    if (positions.length < 2) return null;

    const all_pos = [];
    positions.forEach((item) => {
        all_pos.push(item.x);
        all_pos.push(item.y);
        all_pos.push(item.z);
    });
    const new_step = (_.max(all_pos) - _.min(all_pos)) / 100;

    (max_iter = max_iter || 1000),
        (target_delta = target_delta || new_step),
        (step = step || new_step),
        (fq = fq || 1);

    function fn(x, y, z, x0, y0, z0, dist) {
        return (
            Math.pow(x - x0, 2) +
            Math.pow(y - y0, 2) +
            Math.pow(z - z0, 2) -
            Math.pow(dist, 2)
        );
    }

    function iter(positions, current) {
        const delta_arr = [];
        for (let index = 0; index < positions.length; index++) {
            const item = positions[index];
            delta_arr.push(
                fn(
                    item.x,
                    item.y,
                    item.z,
                    current.x,
                    current.y,
                    current.z,
                    item.distance
                )
            );
        }
        return delta_arr;
    }

    function get_best_vector(positions, current) {
        let best_direction = 0;
        let best_delta_mean = 1000000;
        for (let direction = 0; direction < vectors.length; direction++) {
            const vector = vectors[direction];

            const new_current = { ...current };
            new_current.x = new_current.x + vector.x * step;
            new_current.y = new_current.y + vector.y * step;
            new_current.z = new_current.z + vector.z * step;

            const delta_arr = iter(positions, new_current);
            const delta_mean = _.sum(delta_arr);
            if (delta_mean < best_delta_mean) {
                best_delta_mean = delta_mean;
                best_direction = direction;
            }
        }
        return vectors[best_direction];
    }

    const vectors = [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: -1 },
        { x: 0, y: -1, z: 0 },
        { x: 0, y: -1, z: -1 },
        { x: -1, y: 0, z: 0 },
        { x: -1, y: 0, z: -1 },
        { x: -1, y: -1, z: 0 },
        { x: -1, y: -1, z: -1 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 1, z: 1 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 0, z: 1 },
        { x: 1, y: 1, z: 0 },
        { x: 1, y: 1, z: 1 },
    ];

    let current_iter = 0;
    let current = {
        x: positions[0].x,
        y: positions[0].y,
        z: positions[0].z,
    };
    let current_vector = get_best_vector(positions, current);
    let last_deltas = [];
    let last_deltas_max_len = 100;

    while (true) {
        let min_delta_mean = 1000000;
        if (current_iter % fq == 0) {
            current_vector = get_best_vector(positions, current);
        }

        current.x = current.x + current_vector.x * step;
        current.y = current.y + current_vector.y * step;
        current.z = current.z + current_vector.z * step;

        const delta_arr = iter(positions, current);
        const delta_mean = _.sum(delta_arr);
        if (delta_mean < min_delta_mean) {
            min_delta_mean = delta_mean;
        }

        last_deltas.push(min_delta_mean);
        if (last_deltas.length >= last_deltas_max_len) {
            last_deltas.shift();
        }

        if (current_iter >= max_iter) {
            // console.log('exit 1')
            break;
        }
        if (min_delta_mean < target_delta) {
            // console.log('exit 2')
            break;
        }
        // console.log('abs', Math.abs(_.mean(last_deltas) - last_deltas[last_deltas.length - 1]))
        if (
            last_deltas.length == last_deltas_max_len - 1 &&
            Math.abs(
                _.mean(last_deltas) - last_deltas[last_deltas.length - 1]
            ) <
                step * 0.1
        ) {
            // console.log('exit 3')
            break;
        }
        current_iter++;
    }
    return current;
};

export function addLayer(map, { name, className }) {
    return map.append("g").attr("name", name).attr("class", className);
}

// images = [{ id, url, image, x, y, w, h }]
export function drawImages(layer, { name, items = [] }) {
    for (var i = 0; i < items.length; i++) {
        if (layer.select(`[id="${items[i].id}"]`).empty()) {
            const imageItem = items[i];
            if (imageItem.url) {
                layer
                    .append("image")
                    .attr("name", name)
                    .attr("id", imageItem.id);
            } else if (imageItem.image) {
                var image = new DOMParser().parseFromString(
                    imageItem.image,
                    "text/html"
                ).body.childNodes[0];
                image.setAttribute("id", imageItem.id);
                image.setAttribute("name", name);
                image.setAttribute("x", imageItem.x);
                image.setAttribute("y", imageItem.y);
                image.setAttribute("width", imageItem.w);
                image.setAttribute("height", imageItem.h);
                layer.node().appendChild(image);
            } else {
                layer
                    .append("circle")
                    .attr("name", name)
                    .attr("id", imageItem.id)
                    .attr("r", (imageItem.w || imageItem.h) / 2);
            }
        }
    }

    var images = layer.selectAll(`[name="${name}"]`).data(items);

    images
        .attr("xlink:href", function (image) {
            return image.url;
        })
        .attr("x", function (image) {
            return image.x;
        })
        .attr("y", function (image) {
            return image.y;
        })
        .attr("cx", function (image) {
            return image.x;
        })
        .attr("cy", function (image) {
            return image.y;
        })
        .attr("width", function (image) {
            return image.w;
        })
        .attr("height", function (image) {
            return image.h;
        });

    return images;
}

export function drawPolygons(layer, { name, items }) {
    if (!items?.length) return {};

    let linePoints = [];
    items.forEach((item) => {
        const lines = [];
        const points = [...item.points, item.points[0]];
        for (var i = 0; i < points.length - 1; i++) {
            lines.push({
                index: i,
                polygon: item.id,
                line: [points[i], points[i + 1]],
            });
        }
        linePoints = linePoints.concat(lines);
    });

    let allPoints = [];
    items.forEach((item) => {
        allPoints = allPoints.concat(
            item.points.map((point, id) => ({
                id: id,
                polygon: item.id,
                creating: id == 0 ? item.creating : false,
                point: point,
            }))
        );
    });

    for (var i = 0; i < items.length; i++) {
        const poly = layer.select(`g.polygon[id="${items[i].id}"]`);
        const polyPoints = poly.selectAll("circle");
        if (!poly.empty() && polyPoints.size() != items[i].points.length) {
            poly.remove();
        }
        if (layer.select(`polygon[id="${items[i].id}"]`).empty()) {
            const points = items[i].points;
            const g = layer
                .append("g")
                .attr("class", "polygon")
                .attr("id", items[i].id);
            g.append("polygon").attr("name", name).attr("id", items[i].id);

            for (var j = 0; j < points.length; j++) {
                // if (j % 2 == 0) {
                g.append("line").attr("name", name);
                // }
                g.append("circle").attr("name", name).attr("r", 4);
            }
            // g.append("line").attr("name", name);
        }
    }

    const polygonItems = layer.selectAll(`polygon[name="${name}"]`).data(items);
    polygonItems
        .attr("points", function (data) {
            return data.points.join(",");
        })
        .classed("selected", function (data) {
            return data.selected || false;
        });

    const lineItems = layer.selectAll(`line[name=${name}]`).data(linePoints);
    lineItems
        .attr("x1", function (data) {
            return data.line[0][0];
        })
        .attr("y1", function (data) {
            return data.line[0][1];
        })
        .attr("x2", function (data) {
            return data.line[1][0];
        })
        .attr("y2", function (data) {
            return data.line[1][1];
        });

    const pointItems = layer.selectAll(`circle[name=${name}]`).data(allPoints);
    pointItems
        .attr("polygon", function (data) {
            return data.id;
        })
        .classed("creating", function (data) {
            return data.creating || false;
        })
        .attr("cx", function (data) {
            return data.point[0];
        })
        .attr("cy", function (data) {
            return data.point[1];
        });

    return { polygons: polygonItems, points: pointItems, line: lineItems };
}

export function drawEvacRoutes(layer, { name, items }) {
    layer.selectAll(`line[name="${name}"]`).remove();

    if (!items?.length) return;

    if (layer.select(`marker[id="arrow"]`).empty()) {
        layer
            .append("defs")
            .append("marker")
            .attr("id", "arrow")
            .attr("viewBox", [0, 0, 12, 12])
            .attr("refX", 6)
            .attr("refY", 6)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("markerUnits", "strokeWidth")
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M2,2 L10,6 L2,10 L6,6 L2,2")
            .style("fill", "#3c7d27");
    }

    const arrows = [];
    for (var i = 0; i < items.length; i++) {
        arrows.push({
            id: items[i].id,
            from: d3.polygonCentroid(items[i].from.points),
            to: d3.polygonCentroid(items[i].to.points),
        });
        if (layer.select(`line[id="${items[i].id}"]`).empty()) {
            layer
                .append("line")
                .attr("name", name)
                .attr("id", items[i].id)
                // .attr("marker-end", "url(#arrow)")
                .classed("evacuation", true);
        }
    }

    const arrowItems = layer.selectAll(`line[name="${name}"]`).data(arrows);
    arrowItems
        .attr("x1", function (data) {
            return data.from[0];
        })
        .attr("y1", function (data) {
            return data.from[1];
        })
        .attr("x2", function (data) {
            return data.to[0];
        })
        .attr("y2", function (data) {
            return data.to[1];
        })
        .attr("marker-start", "url(#arrow)")
        .attr("marker-end", "url(#arrow)");
}

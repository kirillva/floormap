<script>
    import * as d3 from "d3v4";
    import _ from "lodash";
    import { getContext } from "svelte";
    import { onMount } from "svelte";
    import {
        addLayer,
        drawEvacRoutes,
        drawImages,
        drawPolygons,
        getPosition,
        uuid,
    } from "./Helpers";
    import "./floorplan.css";
    import "./styles.css";
    import BluetoothIcon from "./bluetooth.js";

    export let floorProvider;
    export let zoneProvider;
    export let sensorProvider;
    export let positionsProvider;
    export let evacuationProvider;

    export let onSave;
    export let onSelect;
    
    let svg;
    let g;

    $: current_floor = 1;
    $: width = 0;
    $: height = 0;
    $: polygonsVisible = true;
    $: sensorsVisible = true;
    $: evacuationVisible = true;
    $: evacuationDrawing = false;
    $: zoneDrawing = false;

    $: floorLayer = null;
    $: sensorLayer = null;
    $: zonesLayer = null;
    $: evacLayer = null;
    $: positionLayer = null;
    
    const editable = true;

    $: floors =
        floorProvider?.rows?.map((item) => ({
            _id: item._id,
            id: item.id,
            name: item.id,
            image: {
                url: item.image.url,
                x: 0,
                y: 0,
                w: item.width,
                h: item.height,
            },
        })) ?? [];

    $: evac_routes =
        evacuationProvider?.rows?.map((item) => ({
            id: item.id,
            from: item.from,
            to: item.to,
        })) ?? [];

    $: zones =
        zoneProvider?.rows?.map((item) => {
            const _item = {
                _id: item._id,
                id: `${item.id}`,
                floor: item.floor,
                name: item.name,
                creating: false,
                color: item.color,
            }
            try {
                _item.points = JSON.parse(item.points);
            } catch (error) {
                _item.points = item.points;
            }
            return _item;
        }) ?? [];

    $: sensors =
        sensorProvider?.rows?.map((item) => ({
            _id: item._id,
            id: `${item.id}`,
            floor: item.floor,
            name: item.name,
            image: BluetoothIcon,
            x: item.x,
            y: item.y,
            w: 32,
            h: 32,
        })) ?? [];

    $: ble_signals = positionsProvider?.rows?.map((item) => ({
        id: item.id,
        sensor_id: item.sensor_id,
        distance: item.distance,
        user_id: item.user_id,
        datetime: item.datetime
    })) ?? [];

    function togglePolygons(visible) {
        polygonsVisible = visible;
        if (visible) {
            d3.selectAll(".zones").style("display", "unset");
        } else {
            d3.selectAll(".zones").style("display", "none");
        }
    }

    function toggleEvacuation(visible) {
        evacuationVisible = visible;
        if (visible) {
            d3.selectAll(".evacuation").style("display", "unset");
        } else {
            d3.selectAll(".evacuation").style("display", "none");
        }
    }

    function toggleSensors(visible) {
        sensorsVisible = visible;
        if (visible) {
            d3.selectAll(".sensors").style("display", "unset");
        } else {
            d3.selectAll(".sensors").style("display", "none");
        }
    }

    function onCreateSensor() {
        var sensor = {
            id: uuid(),
            name: uuid(),
            image: BluetoothIcon,
            floor: current_floor,
            x: 50,
            y: 50,
            w: 32,
            h: 32,
        };
        sensors = [...sensors, sensor];
    }

    function onCreateZone() {
        zoneDrawing = true;
    }

    function onCreateEvacuation() {
        evacuationDrawing = true;
    }
    
    function onClearEvacuation() {
        const zoneIndex = zones.findIndex(item=>item.selected == true);
        if (zoneIndex < 0) return;

        evac_routes = evac_routes.filter(item => item.from != zones[zoneIndex].id && item.to != zones[zoneIndex].id)
        evac_routes = [...evac_routes.map(item=>({...item }))];
    }

    function zoomed() {
        g.attr("transform", d3.event.transform);
    }

    $: {
        console.log('floors', floors);
    }
    
    $: {
        if (floorLayer) {
            const floorItems = drawImages(floorLayer, {
                name: "floor-1",
                items: floors.map((item) => ({
                    id: item.id,
                    url: item.image.url,
                    x: item.image.x,
                    y: item.image.y,
                    w: item.image.w,
                    h: item.image.h,
                })),
            });

            floorItems?.on("click", function(sender){
                if (!editable) return;

                zones = zones.map(item=>({...item, selected: false}));
            });

            const { w, h } = floors[0]?.image || {};
            width = w;
            height = h;
            console.log("sizes", w, h, floors[0]);
        }

        if (sensorLayer) {
            const sensorItems = drawImages(sensorLayer, {
                name: "sensors-1",
                items: sensors.map((item) => ({
                    id: item.id,
                    image: item.image,
                    x: item.x,
                    y: item.y,
                    w: item.w,
                    h: item.h,
                })),
            });
            sensorItems?.call(
                d3.drag().on("end", function (sender) {
                    if (!editable) return;

                    const index = sensors.findIndex(item=>item.id == sender.id);
                    sensors[index] = {...sensors[index], x: d3.event.x, y: d3.event.y};
                    sensors = [...sensors];
                }),
            );
        }

        if (zonesLayer) {
            const { polygons: zonesItems, points: zonePointItems, line: zoneLineItems } =
                drawPolygons(zonesLayer, {
                    name: "zones-1",
                    items: zones.map((item) => ({
                        id: item.id,
                        selected: item.selected,
                        creating: item.creating,
                        points: item.points,
                    })),
                });

            zoneLineItems?.on("click", function(sender){
                if (!editable) return;

                const index = zones.findIndex(item=>item.id == sender.polygon);
                const points = zones[index].points;
                const item = [d3.event.offsetX, d3.event.offsetY];
                zones[index].points = [
                    ...points.slice(0, sender.index + 1), 
                    item, 
                    ...points.slice(sender.index + 1)
                ]
                zones = [...zones];
            });
            zonesItems?.on("click", function(sender){
                if (!editable) return;
                
                const index = zones.findIndex(item=>item.id == sender.id);
                const fromIndex = zones.findIndex(item=>item.selected == true);
                if (evacuationDrawing && fromIndex >= 0) {
                    const toIndex = index;
                    evac_routes = [...evac_routes, {
                        id: uuid(),
                        from: zones[fromIndex].id,
                        to: zones[toIndex].id,
                    }];
                    evacuationDrawing = false;
                }

                zones = zones.map(item=>({...item, selected: false}));
                zones[index].selected = true;
                zones = [...zones];
            });
            zonesItems?.call(
                d3.drag().on("end", function (sender) {
                    if (!editable) return;
                    if (!sender.selected) return;

                    const index = zones.findIndex(item=>item.id == sender.id);
                    const oldCenter = d3.polygonCentroid(zones[index].points);
                    const diff = [d3.event.x- oldCenter[0], d3.event.y - oldCenter[1]]

                    zones[index] = {
                        ...zones[index], 
                        points: zones[index].points.map(item=>([item[0] + diff[0], item[1] + diff[1]]))
                    };
                    zones = [...zones];
                }),
            );
            zonePointItems?.on("click", function(sender){
                if (!editable) return;

                const index = zones.findIndex(item=>item.id == sender.polygon);
                if (sender.id == 0) {
                    zones[index].creating = false;
                    zoneDrawing = false;
                    zones = [...zones];
                }
            }, true);

            zonePointItems?.call(
                d3.drag().on("end", function (sender) {
                    if (!editable) return;

                    const index = zones.findIndex(item=>item.id == sender.polygon);
                    zones[index].points[sender.id] = [d3.event.x, d3.event.y]
                    zones = [...zones]
                })
            )
        }

        if (evacLayer) {
            const zonesObj = {};
            zones.forEach((item) => {
                zonesObj[item.id] = item;
            });

            drawEvacRoutes(evacLayer, {
                name: "evacuation-1",
                items: evac_routes.map((route) => {
                    const from = zonesObj[route.from];
                    const to = zonesObj[route.to];
                    return {
                        id: route.id,
                        from: from,
                        to: to,
                    };
                }),
            });
        }

        if (positionLayer) {
            const sensors_obj = {};
            sensors.forEach((item) => {
                sensors_obj[item.id] = item;
            });

            const ble_signal_positions = ble_signals.map((item) => {
                const sensor = sensors_obj[item.sensor_id];
                return {
                    id: item.id,
                    sensor_id: item.sensor_id,
                    distance: item.distance,
                    user_id: item.user_id,
                    datetime: item.datetime,
                    x: sensor.x,
                    y: sensor.y,
                    z: sensor.floor * 500,
                };
            });
            const pos = getPosition(ble_signal_positions);
            console.log('pos', pos);
            if (pos) {
                drawImages(positionLayer, {
                    name: "position-1",
                    items: [{
                        id: 0,
                        x: pos.x,
                        y: pos.y,
                        w: 32,
                        h: 32,
                    }]
                });
            }
        }

        const zoom = d3
            .zoom()
            .scaleExtent([1, Infinity])
            .translateExtent([
                [0, 0],
                [width, height],
            ])
            .extent([
                [0, 0],
                [width, height],
            ])
            .on("zoom", zoomed);

        if (svg) {
            svg.call(zoom);
        }
    }

    onMount(async () => {
        svg = d3.select("#main");
        width = +svg.attr("width");
        height = +svg.attr("height");

        g = svg.append("g");

        g?.on("click", function(sender){
            if (!editable) return;
            if (!zoneDrawing) return;
            
            const creatingZoneIndex = zones.findIndex(item=>item.creating == true);
            if (creatingZoneIndex < 0) {
                const index = uuid();
                zones = [...zones, {
                    id: index,
                    floor: current_floor,
                    name: index,
                    points: [[d3.event.offsetX, d3.event.offsetY]],
                    creating: true,
                    selected: false
                }]
            } else {
                zones[creatingZoneIndex].points.push([d3.event.offsetX, d3.event.offsetY]);
                zones = [...zones];
            }
        });

        
        if (!floorLayer) {
            floorLayer = addLayer(g, { name: "floors", className: "floors" });
        }

        if (!sensorLayer) {
            sensorLayer = addLayer(g, {
                name: "sensors",
                className: "sensors",
            });
        }

        if (!zonesLayer) {
            zonesLayer = addLayer(g, { name: "zones", className: "zones" });
        }

        if (!evacLayer) {
            evacLayer = addLayer(g, {
                name: "evacuation",
                className: "evacuation",
            });
        }

        if (!positionLayer) {
            positionLayer = addLayer(g, {
                name: "positions",
                className: "positions",
            });
        }
    });

    // function onSave() {
    //     // zones
    //     const zonesData = [];
    //     zones.forEach((item) => {
    //         var zone = d3.select(`.zone-${item.id}`);
    //         var points = d3.select(zone.node()).selectAll("circle");

    //         var position = zone.data()?.[0];
    //         var pointsPosition = [];

    //         points._groups[0].forEach((item) => {
    //             pointsPosition.push([
    //                 parseInt(item.getAttribute("cx")) + position.x,
    //                 parseInt(item.getAttribute("cy")) + position.y,
    //             ]);
    //         });

    //         const obj = {
    //             _id: item._id,
    //             id: item.id,
    //             name: item.name,
    //             points: pointsPosition,
    //         };
    //         zonesData.push(obj);
    //     });
    //     if (onChangeZone) {
    //         zonesData.forEach((item) => {
    //             onChangeZone({
    //                 item: item,
    //             });
    //         });
    //     }

    //     // sensors
    //     const sensorsData = [];
    //     sensors.forEach((item) => {
    //         var sensor = d3.select(`.sensor-${item.id}`);

    //         var position = sensor.data()?.[0];

    //         const obj = {
    //             _id: item._id,
    //             id: item.id,
    //             name: item.name,
    //             x: item.x + position.x,
    //             y: item.y + position.y,
    //         };
    //         sensorsData.push(obj);
    //     });
    //     if (onChangeSensor) {
    //         sensorsData.forEach((item) => {
    //             onChangeSensor({
    //                 item: item,
    //             });
    //         });
    //     }
    // }
</script>

<div class="buttons">
    {#if editable}
        <button
            disabled={zoneDrawing}
            class={`spectrum-Button spectrum-Button--sizeM spectrum-Button--cta gap-M svelte-4lnozm`}
            on:click={onCreateZone}>Create Zone</button
        >
        <button
            class={`spectrum-Button spectrum-Button--sizeM spectrum-Button--cta gap-M svelte-4lnozm`}
            on:click={onCreateSensor}>Place sensor</button
        >
        <button
            disabled={evacuationDrawing}
            class={`spectrum-Button spectrum-Button--sizeM spectrum-Button--cta gap-M svelte-4lnozm`}
            on:click={onCreateEvacuation}>Create evacuation</button
        >
        <button
            class={`spectrum-Button spectrum-Button--sizeM spectrum-Button--cta gap-M svelte-4lnozm`}
            on:click={onClearEvacuation}>Clear evacuation</button
        >
    {/if}
    {#each floors as floor}
        <button
            class={`spectrum-Button spectrum-Button--sizeM spectrum-Button--cta gap-M svelte-4lnozm`}
            on:click={() => {
                current_floor = floor.id;
            }}
        >
            {floor.id}
        </button>
    {/each}
</div>
<svg class="map" id="main" {width} {height}></svg>

<div class="controllers">
    <button
        class={`spectrum-Button spectrum-Button--sizeM spectrum-Button--cta gap-M svelte-4lnozm`}
        on:click={() => togglePolygons(!polygonsVisible)}>Zones</button
    >
    <button
        class={`spectrum-Button spectrum-Button--sizeM spectrum-Button--cta gap-M svelte-4lnozm`}
        on:click={() => toggleSensors(!sensorsVisible)}>Sensors</button
    >
    <button
        class={`spectrum-Button spectrum-Button--sizeM spectrum-Button--cta gap-M svelte-4lnozm`}
        on:click={() => toggleEvacuation(!evacuationVisible)}
        >Evacuation</button
    >
</div>

<style>
    .buttons {
        display: flex;
        position: absolute;
        gap: 4px;
    }
    .controllers {
        display: flex;
        position: absolute;
        gap: 4px;
    }
    .map {
        margin: 32px 32px 0;
    }
</style>

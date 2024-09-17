<script>
  import Map from "../lib/Map.svelte";
  import { setContext } from "svelte";
  import example from "../lib/example.json";

  setContext("sdk", {
    styleable: {},
  });
</script>

<Map 
    evacuationProvider={{rows: example['evac_routes']}}
    floorProvider={{rows: example['floors']}}
    zoneProvider={{rows: example['zones']}}
    sensorProvider={{rows: example['sensors']}}
    positionsProvider={{rows: example['ble_signals']}}
/>

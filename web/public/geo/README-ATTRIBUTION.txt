indonesia-provinsi.geojson — Batas 38 Provinsi Indonesia (disederhanakan untuk web)
==================================================================================

ATTRIBUTION (wajib dicantumkan di peta/aplikasi):
  © OpenStreetMap contributors — data tersedia di bawah Open Database License (ODbL).
  https://www.openstreetmap.org/copyright

LICENSE
  Open Database License (ODbL) v1.0 — https://opendatacommons.org/licenses/odbl/1-0/
  File ini adalah "Derivative Database" dari OpenStreetMap, sehingga file ini juga
  berlisensi ODbL (share-alike): jika dipublikasikan/didistribusikan, sertakan
  atribusi di atas dan tetap di bawah ODbL. Peta/choropleth yang dirender dari file
  ini adalah "Produced Work": cukup tampilkan atribusi "© OpenStreetMap contributors".

SOURCES
  1. Batas provinsi: relasi OpenStreetMap boundary=administrative, admin_level=4,
     ISO3166-2=ID-* (38 relasi), diambil via Overpass API (snapshot OSM
     2026-10-30T02:07Z) dan geometri per relasi dari
     https://polygons.openstreetmap.fr/get_geojson.py?id=<relation_id>&params=0
     (dibuat 2026-10-30).
  2. Garis pantai: OSM "simplified-land-polygons-complete-3857"
     https://osmdata.openstreetmap.de/data/land-polygons.html (versi 2026-10-29),
     juga © OpenStreetMap contributors, ODbL.

PROCESSING
  - Batas provinsi kepulauan di OSM berupa wilayah laut (maritim), jadi semua
    provinsi di-clip ke poligon daratan OSM (mapshaper -clip).
  - mapshaper 0.7.101: -simplify 5% keep-shapes -clean -filter-fields provinsi
    -o precision=0.0001 format=geojson
  - Nama dinormalisasi: "Daerah Khusus Ibukota Jakarta" -> "DKI Jakarta",
    "Daerah Istimewa Yogyakarta" -> "DI Yogyakarta"; lainnya sesuai tag name OSM.

FORMAT
  - FeatureCollection, 38 fitur (Polygon/MultiPolygon), satu properti: "provinsi".
  - CRS: WGS84 lon/lat (EPSG:4326), tanpa member "crs".
  - Bounding box: 95.04, -10.92, 141.02, 5.90.
  - Urutan ring: outer ring berlawanan arah jarum jam (RFC 7946). Leaflet,
    MapLibre, ECharts aman. d3-geo butuh arah sebaliknya (searah jarum jam):
    rewind dulu (mis. @turf/rewind dengan {reverse: true}). Jika peta d3 tampil
    sebagai satu blok penuh/terbalik, ini penyebabnya.
  - Geometri valid (shapely is_valid), tanpa overlap antarprovinsi.

CAVEATS
  - Pulau sangat kecil hilang karena garis pantai yang sudah disederhanakan
    (mis. Pulau Miangas dan Kepulauan Seribu/DKI Jakarta tidak ada).
  - Batas OSM bukan batas resmi BIG/Kemendagri; akurasinya cukup untuk choropleth
    skala nasional, bukan untuk keperluan legal/kadaster.

let map = new mapboxgl.Map({
    container: 'map',
    center: [138.964426, 36.05962078],
    pitch: 0,
    zoom: 5,
    //style: "mapbox://styles/demovendor/clniiq3rr025t01qnbgdk85yg",
    //hash: false,
    //attributionControl: false,
    language: 'ja,en'
})

const homeMarker = new mapboxgl.Marker()
const geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    countries: 'jp',
    language: 'ja',
    limit: 10,
    marker: false
})
map.addControl(geocoder)
geocoder.on('result', function (ev) {
    removeIsochrone()
    setHome(ev.result)
})

let home_coords
const setHome = (feature) => {
    document.getElementById('placeName').innerHTML = feature.place_name
    const details = [
        { title: "緯度", val: feature.geometry.coordinates[0] },
        { title: "経度", val: feature.geometry.coordinates[1] }
    ]
    const placedata = document.getElementById('placeData')
    placedata.innerHTML = ''
    for (let detail of details) {
        const dt = placedata.appendChild(document.createElement('dt'))
        dt.innerHTML = detail.title
        const dd = placedata.appendChild(document.createElement('dd'))
        dd.innerHTML = detail.val
    }
    homeMarker.setLngLat(feature.geometry.coordinates).addTo(map)
    home_coords = feature.geometry.coordinates
    document.getElementById('home-iso').style.display = 'block'
    removeAllRoutes(map)
    jobMarker.remove()
}

const flyHome = () => {
    if (home_coords) {
        map.flyTo({
            center: home_coords,
            zoom: 14
        })
    }
}

const loadImages = () => {
    for (let i in poi_images) {
        const poi = poi_images[i]
        document.documentElement.style.setProperty(poi.css_param, 'url(' + poi.img + ')')
        let image = new Image()
        image.onload = function () {
            map.addImage(i, image)
        }
        image.src = poi.img
    }
    document.getElementById('logo').src = staffing_image
    document.getElementById('close').src = btn_close_image
}

let popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false
})
map.on('mousemove', 'jobs', (e) => {
    const f = getJobFeature(e)
    if (f != null) {
        map.getCanvas().style.cursor = 'pointer'
        const html = `【${f.properties.name}】<br/>${f.properties.company}`
        if (!popup.isOpen()) {
            popup.setLngLat(f.geometry.coordinates)
                .setHTML(html)
                .addTo(map)
        }
    }
})
map.on('mousemove', 'pois', (e) => {
    const f = getPoiFeature(e)
    if (f != null) {
        map.getCanvas().style.cursor = 'pointer'
        const html = `${f.properties.name}<br/><br/>【住所】${f.properties.address}`
        if (!popup.isOpen()) {
            popup.setLngLat(f.geometry.coordinates)
                .setHTML(html)
                .addTo(map)
        }
    }
})

map.on('dblclick', (e) => {
    removeIsochrone()
    closeModal()
    const c = e.lngLat
    fetchReverseSearchAddress([c.lng, c.lat]).then(json => {
        if (json.features && json.features.length > 0) {
            const f = json.features[0]
            f.place_name = f.properties.place_name
            setHome(f)
        } else {
            alert("見つかりませんでした。別の場所を指定して下さい。")
        }
    })
})

const getJobFeature = (e) => {
    let coordinates = e.point
    const features = map.queryRenderedFeatures(coordinates, {
        layers: ['jobs']
    })
    if (features.length > 0) {
        return features[0]
    }
    return null
}

const getPoiFeature = (e) => {
    let coordinates = e.point
    const features = map.queryRenderedFeatures(coordinates, {
        layers: [pois]
    })
    if (features.length > 0) {
        return features[0]
    }
    return null
}

map.on('mouseleave', 'jobs', function () {
    map.getCanvas().style.cursor = ''
    popup.remove()
})
map.on('mouseleave', 'pois', function () {
    map.getCanvas().style.cursor = ''
    popup.remove()
})

let jobCoords
const jobMarker = new mapboxgl.Marker({ color: "rgb(255, 105, 180)" })
const pois = 'pois'
map.on('click', 'jobs', async (e) => {
    const f = getJobFeature(e)
    if (f != null) {
        document.getElementById('jobName').innerHTML = f.properties.company
        const details = [
            { title: "仕事内容：", val: f.properties.name },
            { title: "種別：", val: f.properties.category },
            { title: "住所：", val: f.properties.address },
            { title: "受注番号：", val: f.properties.receive_number },
            { title: "支払コード：", val: f.properties.payroll }
        ]
        const jobDetails = document.getElementById('jobDetails')
        jobDetails.innerHTML = ''
        /*for (let detail of details) {
            const dt = jobDetails.appendChild(document.createElement('dt'))
            dt.innerHTML = detail.title
            const dd = jobDetails.appendChild(document.createElement('dd'))
            dd.innerHTML = detail.val
        }*/
        addDetails(jobDetails, details)
        const areaList = document.getElementById('area_list')
        areaList.innerHTML = ''
        for (let i in poi_categories) {
            const cat = poi_categories[i]
            const li = areaList.appendChild(document.createElement('li'))
            const p = li.appendChild(document.createElement('p'))
            p.setAttribute('data-life', cat.label)
            p.innerHTML = cat.label
            const div = li.appendChild(document.createElement('div'))
            div.className = 'toggle_button'
            div.innerHTML = `<input id="toggle" category='${i}' class="toggle_input" type='checkbox' onChange="categorySearch(this)" />
            <label for="toggle" class="toggle_label"></label>`
        }
        const c = JSON.parse(f.properties.offset_coordinates)
        jobMarker.setLngLat({lng:c[0], lat:c[1]}).addTo(map)
        openModal()
        closeSidebar()
        if (home_coords) {
            removeAllRoutes(map)
            routes = []
            const etaObj = []
            await setRoute(map, home_coords, [f.properties.lng, f.properties.lat], 'red', etaObj)
            const additionalDetails = [
                { title: "距離：", val: `${etaObj.distance_km} km` },
                { title: "車所用時間：", val: `${etaObj.duration_mins} 分` }
            ]
            addDetails(jobDetails, additionalDetails)
        }
        jobCoords = [f.properties.lng, f.properties.lat]
        setMapBounds()
        createPois()
    }
})

const removePois = () => {
    if (map.getLayer(pois)) {
        map.removeLayer(pois)
        map.removeSource(pois)
    }
    poi_filter = [""]
    poi_searched = []
}

const createPois = () => {
    removePois()
    const featureCollection = {
        type: 'FeatureCollection',
        features: []
    }
    map.addSource(pois, {
        type: 'geojson',
        data: featureCollection
    })
    map.addLayer({
        id: pois,
        type: 'symbol',
        source: pois,
        "layout": {
            "text-size": 12,
            "icon-size": 1.2,
            "icon-image": ["image", ["get", "maki"]],
            'icon-padding': 0,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-anchor': 'center'
        }
    })
}

const addDetails = (elem, details) => {
    for (let detail of details) {
        const dt = elem.appendChild(document.createElement('dt'))
        dt.innerHTML = detail.title
        const dd = elem.appendChild(document.createElement('dd'))
        dd.innerHTML = detail.val
    }
}


let job_types = {}
const plotJobs = () => {
    const jobFeatures = {
        type: "FeatureCollection",
        features: []
    }

        for (let job of jobs) {
            const workdayArray = job.workday.split(" ")
            const titleArray = job.title.split(" ")
            const jobName = workdayArray[0]
            const feature = {
                properties: job,
                geometry: {
                    type: "Point",
                    coordinates: [job.lng, job.lat]
                }
            }
            feature.properties.name = jobName
            feature.properties.category = workdayArray[2]
            feature.properties.company = titleArray[2]
            feature.properties.receive_number = titleArray[1]
            jobFeatures.features.push(feature)
            if (!job_types[jobName]) {
                job_types[jobName] = {
                    count: 1,
                    category: feature.properties.category
                }
            } else {
                job_types[jobName].count = job_types[jobName].count + 1
            }
        }
        offsetDuplicateCoordinates(jobFeatures)
        map.addSource('jobs', {
            type: 'geojson',
            data: jobFeatures,
            // cluster: true,
            // clusterMaxZoom: 14,
            // clusterRadius: 50
        })
        map.addLayer({
            id: "jobs",
            type: "circle",
            source: 'jobs',
            paint: {
                'circle-radius': 7,
                'circle-color': 'rgb(255, 105, 180)',
                'circle-stroke-color': 'rgb(0,0,0)',
                'circle-stroke-width': 2
            },
            filter: ['==', ['get', 'workday'], ''],
        })
        createJobFilter()

        /*map.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'jobs',
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': [
                    'step',
                    ['get', 'point_count'],
                    '#51bbd6',
                    100,
                    '#f1f075',
                    750,
                    '#f28cb1'
                ],
                'circle-radius': [
                    'step',
                    ['get', 'point_count'],
                    20,
                    100,
                    30,
                    750,
                    40
                ]
            }
        });

        map.addLayer({
            id: 'cluster-count',
            type: 'symbol',
            source: 'jobs',
            filter: ['has', 'point_count'],
            layout: {
                'text-field': '{point_count_abbreviated}',
                'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                'text-size': 12
            }
        });*/
}

const createJobFilter = () => {
    //const jobType = document.getElementById('jobtypes')
    for (let id in job_types) {
        const type = job_types[id]
        let ul = document.getElementById(type.category)
        if (!ul) {
            const leftinner = document.getElementById("leftinner")
            const h3 = leftinner.appendChild(document.createElement('h3'))
            h3.innerHTML = type.category
            ul = leftinner.appendChild(document.createElement('ul'))
            ul.id = type.category
            ul.className = "toggle_button_list"
        }
        const li = ul.appendChild(document.createElement('li'))
        li.key = ''
        li.innerHTML = `<div class='circle-label'>
            <span>${type.count}</span>
            </div>
            <p>               
                ${id}
            </p>
            <div class="toggle_button">
                <input id="toggle" class="toggle_input" type='checkbox' onChange='toggleJobFilter(this)' value='${id}' />
                <label for="toggle" class="toggle_label" ></label>
            </div>`
    }
    openSidebar()
}

const toggleSide = (elements) => {
    if (elements.target) {
        if (isSideOpen(elements)) {
            elements.target.classList.remove('active')
        } else {
            elements.target.classList.add('active')
        }
    }
    if (elements.toggleBtn) {
        if (isSideOpen(elements)) {
            elements.toggleBtn.children[0].classList.remove('active')
        } else {
            elements.toggleBtn.children[0].classList.add('active')
        }
    }
}

const isSideOpen = (elements) => {
    if (elements.target && elements.target.classList.contains('active')) {
        return true
    } else {
        return false
    }
}

const toggleSidebar = () => {
    const elements = {
        toggleBtn: document.getElementById('sidebarToggleBtn'),
        target: document.getElementById('sidebar')
    }
    toggleSide(elements)
    const modal = document.getElementById('modal')
    if (elements.toggleBtn?.children[0].classList.contains('active')) {
        modal?.classList.remove('moved')
    } else {
        modal?.classList.add('moved')
    }
}

const openSidebar = () => {
    if (!isSideOpen({
        toggleBtn: document.getElementById('sidebarToggleBtn'),
        target: document.getElementById('sidebar')
    })) {
        setTimeout(toggleSidebar, 1)
    }
}

const closeSidebar = () => {
    if (isSideOpen({
        toggleBtn: document.getElementById('sidebarToggleBtn'),
        target: document.getElementById('sidebar')
    })) {
        setTimeout(toggleSidebar, 1)
    }
}

const closeModal = () => {
    if (document.getElementById('modal') !== null) {
        const modal = document.getElementById('modal')
        modal.close()
    }
    removeAllRoutes(map)
    removePois()
    jobMarker.remove()
    setMapBounds()
}

const openModal = () => {
    if (document.getElementById('modal') !== null) {
        const modal = document.getElementById('modal');
        modal.show()
    }
}

/*const toggleBukken = () => {
    const elements = {
        toggleBtn: document.getElementById('selectBukkenToggleBtn'),
        target: document.getElementById('selectBukken')
    }
    toggleSide(elements)
    const geocoder = document.getElementById('search_div')
    if (elements.toggleBtn && elements.toggleBtn.children[0].classList.contains('active')) {
        geocoder?.classList.remove('moved')
    } else {
        if(elements.toggleBtn){
            geocoder?.classList.add('moved')
        }
    }
}

const openBukken = () => {
    if (!isSideOpen({
        toggleBtn: document.getElementById('selectBukkenToggleBtn'),
        target: document.getElementById('selectBukken')
    })) {
        toggleBukken()
    }
}*/

let job_filter = ['']
const toggleJobFilter = (checkbox) => {
    if (checkbox.checked && !job_filter.includes(checkbox.value)) {
        job_filter.push(checkbox.value)
    } else if (!checkbox.checked && job_filter.includes(checkbox.value)) {
        job_filter = job_filter.filter(item => item != checkbox.value)
    }
    const filter = ['match', ['get', 'name'], job_filter, true, false]
    map.setFilter('jobs', filter)
}

const offsetDuplicateCoordinates = (featureCollection) => {
    const offsetAmount = 0.00001
    const offsetMap = new Map()

    featureCollection.features.forEach(feature => {
        let coordinates = feature.geometry.coordinates
        const coordinateString = coordinates.join('_')
        if (!offsetMap.has(coordinateString)) {
            offsetMap.set(coordinateString, coordinates)
        } else {
            coordinates = offsetMap.get(coordinateString)
            const newCoordinates = coordinates.map(coord => coord + offsetAmount)
            offsetMap.set(coordinateString, newCoordinates)
        }
        coordinates = offsetMap.get(coordinateString)
        feature.geometry.coordinates = coordinates
        feature.properties.offset_coordinates = coordinates
    });

    return featureCollection;
}

let contours
const iso = 'iso'
const isoLine = 'iso-line'
const setIsochroneLayers = (elem) => {
    const range = elem.value
    contours = [0]
    if (!home_coords) return
    if (range >= "1") {
        contours.push(15)
    }
    if (range >= "2") {
        contours.push(30)
    }
    if (range >= "3") {
        contours.push(60)
    }
    const filter = ['match', ['get', 'contour'], contours, true, false]
    if (!isIsoCoordChange()) {
        map.setFilter(iso, filter)
        map.setFilter(isoLine, filter)
        setMapBounds()
        return
    }
    if (range < 1) return
    getIsochrone(home_coords).then(json => {
        map.addSource(iso, {
            type: "geojson",
            data: json
        })
        map.addLayer({
            id: iso,
            slot: 'bottom',
            type: 'fill',
            source: iso,
            paint: {
                'fill-color': ['get', 'fill'],
                'fill-opacity': ['get', 'fill-opacity'],
                'fill-outline-color': ['get', 'fill']
            },
            filter: filter
        })
        map.addLayer({
            id: isoLine,
            type: 'line',
            slot: 'bottom',
            source: iso,
            paint: {
                'line-color': ['get', 'fill'],
                'line-width': 2
            },
            filter: filter
        })
        setMapBounds()

    })
}

const setMapBounds = () => {

    const featureCollection = {
        type: "FeatureCollection",
        features: []
    }
    const isosource = map.getSource(iso)
    if (isosource) {
        const isodata = isosource._data
        for (let f of isodata.features) {
            if (contours.includes(f.properties.contour)) {
                featureCollection.features.push(f)
            }
        }
    }
    const routedata = getAllRoutes(map)
    for (let f of routedata.features) {
        featureCollection.features.push(f)
    }
    if (featureCollection.features.length < 1) return
    map.fitBounds(turf.bbox(featureCollection), {
        padding: 200
    })
}

let iso_coordinates
function getIsochrone(coordinates, contours) {
    iso_coordinates = coordinates
    return fetchIsochrone('mapbox/driving', iso_coordinates, '15,30,60')
}

const removeIsochrone = () => {
    document.getElementById('isochroneString').value = "0"
    if (map.getLayer(iso)) {
        map.removeLayer(iso)
        map.removeLayer(isoLine)
        map.removeSource(iso)
    }
}

const isIsoCoordChange = () => {
    if (iso_coordinates && home_coords &&
        (iso_coordinates[0] === home_coords[0]) &&
        (iso_coordinates[1] === home_coords[1])) {
        return false
    }
    return true
}

let poi_filter = [""]
let poi_searched = []
const categorySearch = async (elem) => {
    const name = elem.getAttribute('category')
    const category = poi_categories[name].category
    const maki = poi_categories[name].maki

    if (!elem.checked) {
        poi_filter = poi_filter.filter(item => item !== category)
    } else if (!poi_searched.includes(category)) {
        const json = await categorySearchWithBbox(category, jobCoords, 5)
        const poidata = map.getSource(pois)._data
        json.features.forEach(f => {
            f.properties.maki = maki
            f.properties.poi_type = category
            poidata.features.push(f)
        });
        map.getSource(pois).setData(poidata)
        poi_searched.push(category)
        poi_filter.push(category)
    } else {
        poi_filter.push(category)
    }

    map.setFilter(pois, ["match", ["get", "poi_type"], poi_filter, true, false])
};


const poi_categories = {
    cafe: {
        label: "カフェ",
        category: "レストラン>カフェ",
        maki: "cafe_image",
        called: false
    },
    eat: {
        label: "食事",
        category: "レストラン",
        maki: "eat_image",
        called: false
    },
    conveniencestore: {
        label: "コンビニ",
        category: "ショップ>コンビニ",
        maki: "conveniencestore_image",
        called: false
    },
    supermarket: {
        label: "スーパー",
        category: "ショップ>スーパー",
        maki: "supermarket_image",
        called: false
    },
    drugstore: {
        label: "薬局",
        category: "医療>薬局",
        maki: "drugstore_image",
        called: false
    },
}

map.on('load', () => {
    map.setConfigProperty('basemap', 'showPointOfInterestLabels', false)
    plotJobs()
    const geocoderContainer = document.getElementsByClassName("mapboxgl-control-container")[0]
    geocoderContainer.id = "search_div"
    loadImages()
})

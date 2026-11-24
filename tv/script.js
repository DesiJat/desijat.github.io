// const API = "https://iptv-org.github.io/api/";
const API = "./data/";

const state = {
    channels: [],
    streams: [],
    logos: [],
    countries: [],
    categories: [],
    languages: []
};

const video = document.getElementById("video");
const playerSection = document.getElementById("playerSection");

let hls = null;

async function fetchData() {
    try {
        const [channels, streams, logos, countries, categories,languages] =
            await Promise.all([
                fetch(API + "channels.json").then(r => {
                    if (!r.ok) throw new Error("Channels unavailable");
                    return r.json();
                }),
                fetch(API + "streams.json").then(r => {
                    if (!r.ok) throw new Error("Streams unavailable");
                    return r.json();
                }),
                fetch(API + "logos.json").then(r => r.json()),
                fetch(API + "countries.json").then(r => r.json()),
                fetch(API + "categories.json").then(r => r.json()),
                fetch(API + "languages.json").then(r => r.json())
            ]);

        state.channels = channels.filter(c => !c.is_nsfw && !c.closed);
        state.streams = streams;
        state.logos = logos;
        state.countries = countries;
        state.categories = categories;
        state.languages = languages;

        populateFilters();
        renderChannels();

        document.getElementById("status").textContent =
            "Choose a channel to start watching.";

    } catch (error) {
        document.getElementById("status").textContent =
            "Unable to load channels. Please refresh the page.";

        console.error(error);
    }
}

function populateFilters() {
    const countrySelect = document.getElementById("countryFilter");
    const categorySelect = document.getElementById("categoryFilter");
    const languageSelect = document.getElementById("languageFilter");

    state.countries.forEach(country => {
        const option = document.createElement("option");
        option.value = country.code;
        option.textContent = country.name;
        countrySelect.appendChild(option);
    });

    state.categories.forEach(category => {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = category.name;
        categorySelect.appendChild(option);
    });

    

state.languages.forEach(language => {
    const option = document.createElement("option");
    option.value = language.code;
    option.textContent = language.name;
    languageSelect.appendChild(option);
});
}

function renderChannels() {
    const search = document.getElementById("search")
        .value.toLowerCase();

    const country = document.getElementById("countryFilter").value;
    const category = document.getElementById("categoryFilter").value;
const language = document.getElementById("languageFilter").value;

    const container = document.getElementById("channels");
    container.innerHTML = "";

    const filtered = state.channels.filter(channel => {
        const matchesSearch =
            channel.name.toLowerCase().includes(search);

        const matchesCountry =
            !country || channel.country === country;

        const matchesCategory =
            !category || (channel.categories || []).includes(category);

        // return matchesSearch && matchesCountry && matchesCategory;
        const matchesLanguage =
    !language || (channel.languages || []).includes(language);

return matchesSearch &&
       matchesCountry &&
       matchesCategory &&
       matchesLanguage;
    });

    document.getElementById("count").textContent =
        filtered.length + " channels";

    if (!filtered.length) {
        container.textContent = "No channels found.";
        return;
    }

    const fragment = document.createDocumentFragment();

    filtered.slice(0, 300).forEach(channel => {
        const stream = state.streams.find(s =>
            s.channel === channel.id
        );

        const logo = state.logos.find(l =>
            l.channel === channel.id && l.in_use
        ) || state.logos.find(l =>
            l.channel === channel.id
        );

        const card = document.createElement("div");
        card.className = "channel";

        const img = document.createElement("img");
        // img.src = logo?.url || "";
        img.src = logo?.url || "images/default-tv.ico";
        img.alt = channel.name;
        img.loading = "lazy";
        img.onerror = () => {
            img.style.display = "none";
        };

        const title = document.createElement("h3");
        title.textContent = channel.name;

        const countryName = state.countries.find(c =>
            c.code === channel.country
        )?.name || channel.country || "Unknown";

        const subtitle = document.createElement("small");
        subtitle.textContent = countryName;

        const availability = document.createElement("small");
        availability.textContent = stream ? "● Available" : "○ No stream";
        availability.style.color = stream ? "#4ade80" : "#94a3b8";

        card.append(img, title, subtitle, availability);

        if (stream) {
            card.addEventListener("click", () => {
                playChannel(channel, stream);
            });
        } else {
            card.style.opacity = ".6";
            card.title = "No stream currently listed";
        }

        fragment.appendChild(card);
    });

    container.appendChild(fragment);
}

function playChannel(channel, stream) {
    playerSection.classList.add("active");

    document.getElementById("playingTitle").textContent =
        "Now Playing: " + channel.name;

    document.getElementById("playerStatus").textContent =
        "Connecting...";

    // Destroy previous HLS instance
    if (hls) {
        hls.destroy();
        hls = null;
    }

    video.pause();
    video.removeAttribute("src");
    video.load();

    const url = stream.url;

    if (Hls.isSupported() && url.includes(".m3u8")) {
        hls = new Hls();

        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {});
            document.getElementById("playerStatus").textContent =
                "Playing";
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                document.getElementById("playerStatus").textContent =
                    "Stream unavailable or blocked.";
            }
        });

    } else {
        video.src = url;

        video.play().then(() => {
            document.getElementById("playerStatus").textContent =
                "Playing";
        }).catch(() => {
            document.getElementById("playerStatus").textContent =
                "Unable to play this stream.";
        });
    }

    playerSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function closePlayer() {
    video.pause();
    video.removeAttribute("src");
    video.load();

    if (hls) {
        hls.destroy();
        hls = null;
    }

    playerSection.classList.remove("active");
}

document.getElementById("search")
    .addEventListener("input", renderChannels);

document.getElementById("countryFilter")
    .addEventListener("change", renderChannels);

document.getElementById("categoryFilter")
    .addEventListener("change", renderChannels);

document.getElementById("languageFilter")
    .addEventListener("change", renderChannels);

fetchData();
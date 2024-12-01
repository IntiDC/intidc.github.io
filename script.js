const progressText = document.getElementById('progress-text');
const progressBar = document.getElementById('progress-bar');
const uploadInput = document.getElementById('image-upload');
const scanButton = document.getElementById('scan-btn');
const imageContainer = document.getElementById('image-container');

const referenceImageURLs = ['./dries1.jpg', './dries2.jpg', './dries3.jpg'];
var labeledDescriptors = [];
var uploadedImages = [];

function loadFaceApiScript() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = './face-api.js';
        script.async = true; // or `defer` if you prefer
        script.onload = resolve; // Resolve the promise once the script is loaded
        script.onerror = reject; // Reject the promise on error
        document.head.appendChild(script);
    });
}


uploadInput.addEventListener('change', (event) => {
    labeledDescriptors = [];
    uploadedImages = Array.from(event.target.files);
    imageContainer.innerHTML = '';
    document.getElementById("choose-pictures").classList.add("loading");
    document.getElementById("progress-container").style.display = "block";
    document.getElementById("data-disclaimer").style.display = "none";
    progressBar.style.width = '0%';
    progressText.innerText = 'Status: Loading face models...';
    loadFaceApiScript()
        .then(() => {
            // Ensure face-api.js is available
            return Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
                faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
                faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
            ]);
        })
        .then(() => {
            progressText.innerText = 'Status: Loading reference images...';
            return loadReferenceImages();
        })
        .then(() => {
            progressText.innerText = 'Status: Starting scan...';
            return initScan();
        })
        .catch((err) => {
            progressText.innerText = `Error: ${err.message}`;
            console.error('Error loading face-api.js or models:', err);
            document.getElementById("choose-pictures").classList.remove("loading");
        });
});

async function loadReferenceImages() {
    progressText.innerText = 'Status: Loading reference images...';
    for (const [index, url] of referenceImageURLs.entries()) {
        try {
            const label = `Dries ${index + 1}`; // Unique label for each reference image
            const image = await loadImageFromURL(url);
            const descriptor = await getFaceDescriptor(image);
            if (descriptor) {
                labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(label, [descriptor]));
            } else {
                console.warn(`No face detected in reference image: ${url}`);
            }
        } catch (error) {
            console.error(`Error processing reference image ${url}:`, error);
        }
    }
    if (!labeledDescriptors.length) {
        throw new Error('No valid reference images were processed.');
    }
    progressText.innerText = 'Status: Reference images loaded. Ready to scan.';
}

async function getFaceDescriptor(image) {
    const detection = await faceapi
        .detectSingleFace(image, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
    return detection ? detection.descriptor : null;
}


async function loadImageFromURL(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image at ${url}`));
    });
}

async function getFaceDescriptor(image) {
    const detection = await faceapi.detectSingleFace(image, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
    return detection ? detection.descriptor : null;
}

async function initScan() {
    if (!uploadedImages.length) {
        progressText.innerText = 'Error: no images found.';
        return;
    }

    if (!labeledDescriptors.length) {
        progressText.innerText = 'Error: No reference images loaded.';
        return;
    }

    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
    let completed = 0;
    const matches = [];

    for (const imageFile of uploadedImages) {
        progressText.innerText = `Status: Scanning photo ${completed + 1} of ${uploadedImages.length}...`;

        const image = await loadImageFromFile(imageFile);
        await scanImage(image, matches, faceMatcher);

        completed++;
        progressBar.style.width = `${(completed / uploadedImages.length) * 100}%`;
    }

    progressText.innerText = matches.length
        ? `Status: Scanning complete. ${matches.length} potential matches found, please review them manually and contact +32 478 697 100 on WhatsApp if you think you have found a match.`
        : `Status: Scanning complete. No matches found.`;


    document.getElementById("choose-pictures").classList.remove("loading");
}


async function loadImageFromFile(file) {
    return new Promise((resolve) => {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.onload = () => resolve(img);
        img.onerror = () => alert('Error loading image!');
    });
}

async function scanImage(image, matches, faceMatcher) {
    const wrapper = document.createElement('div');
    wrapper.className = 'image-wrapper';

    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;

    const detections = await faceapi.detectAllFaces(image, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

    const ctx = canvas.getContext('2d');
    let matchFound = false;

    for (const detection of detections) {
        const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
        if (bestMatch.label !== 'unknown') {
            matches.push(bestMatch.label);
            const box = detection.detection.box;
            ctx.lineWidth = 4;
            ctx.font = '30px Arial';
            if (bestMatch._distance < 0.25) {
                ctx.fillStyle = 'green';
                ctx.strokeStyle = 'green';
                ctx.strokeRect(box.x, box.y, box.width, box.height);
                ctx.fillText("Looks like Dries!", box.x, box.y - 10);
            }
            else if (bestMatch._distance < 0.50) {
                ctx.fillStyle = 'yellow';
                ctx.strokeStyle = 'yellow';
                ctx.strokeRect(box.x, box.y, box.width, box.height);
                ctx.fillText("Could be Dries", box.x, box.y - 10);

            }
            else if (bestMatch._distance < 0.75) {
                ctx.fillStyle = 'orange';
                ctx.strokeStyle = 'orange';
                ctx.strokeRect(box.x, box.y, box.width, box.height);
                ctx.fillText("Possibly Dries", box.x, box.y - 10);

            }
            else if (bestMatch._distance < 100) {
                ctx.fillStyle = 'red';
                ctx.strokeStyle = 'red';
                ctx.strokeRect(box.x, box.y, box.width, box.height);
                ctx.fillText("Could be Dries", box.x, box.y - 10);
            }
            matchFound = true;
        }
    }

    if (matchFound) {
        wrapper.appendChild(image);
        wrapper.appendChild(canvas);
        imageContainer.appendChild(wrapper);
    }
}

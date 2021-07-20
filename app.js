"use strict";
/*
 *
 * Assignment 1 barcode decoder app
 *
 * Copyright (c) 2017  Monash University
 *
 * Author(s): Michael Wybrow and Nawfal Ali
 *
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
*/

const video = document.querySelector('video');
const canvas = document.querySelector('canvas');
const context = canvas.getContext('2d');
var capturingIntervalID = null;
const unitTime = 50;

function cameraErrorCallback(error)
{
    displayMessage(String(error), 4000);
    console.log("Camera: ", error);
}


function startCamera()
{
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices)
    {
        cameraErrorCallback("Camera not available");
        return;
    }

    // Support different browsers
    navigator.getUserMedia = navigator.getUserMedia ||
                             navigator.webkitGetUserMedia ||
                             navigator.mozGetUserMedia ||
                             navigator.msGetUserMedia;

    let devicesAr = [];
    navigator.mediaDevices.enumerateDevices().then(function (devices) {
        // Look through each potential media devices for video devices.
        devices.forEach(function (device) {
            if (device.kind == "videoinput") {
                // If device is a video input add to array.
                devicesAr.push(device);
            }
        });
    }).then(function () {
        console.log("Video sources: " + devicesAr.length);

        let constraints = {
            audio:false,
            width: {
                exact:720
            },
            height: {
                exact:1280
            }
        };

        if (devicesAr.length > 0)
        {
	    let deviceId = devicesAr[devicesAr.length - 1].deviceId;
            constraints.video = {
                deviceId: deviceId
            };
        }

        navigator.mediaDevices.getUserMedia(constraints)
            .then(function (mediaStream) {
                video.srcObject        = mediaStream;
                video.onloadedmetadata = function (e) {
                    video.play();
                };
            })
            .catch(function (err) {
                if (err.name === "PermissionDeniedError")
                {
                    cameraErrorCallback("Camera permission error");
                }
                else
                {
                    cameraErrorCallback(err.name + ": " + err.message);
                }
            });
    }).then(function () {
        // We were able to set up the camera.
        capturingIntervalID = setInterval(snapshot, unitTime);
    });
}

// Initialise camera after short delay.
setTimeout(startCamera, 400);


// snapshot is called multiple times a second.  It tries to detect a barcode
// and if one is found it displays the barcode and visualises it on top of
// the camera image.
function snapshot()
{
    if (video.readyState <= 1)
    {
        // Skip this function if the camera is not yet ready.
        console.log("Video element not yet ready.");
        return;
    }

    // Draw the video frame to an HTML canvas element.  We do this rather
    // than show a live camera image so that what is shown is in sync with
    // what is displayed to the user.

    // Fit the video to the app width, and make the height 70% of this.
    canvas.width = video.videoWidth;
    canvas.height = Math.round(video.videoWidth * 0.7);
    console.log("Video source dimensions: " + video.videoWidth + "x" +video.videoHeight);
    context.clearRect(0, 0, canvas.width, canvas.height);
    // Display the frame from the camera.
    context.drawImage(video, 0, 50, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);

    // Get the image data from the frame and see if we can find a barcode in it.
    let imageData   = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let imageStatus = findBarcode(canvas.width, canvas.height, imageData);
    if (imageStatus === null)
    {
        return;
    }

    // Format barcode with spaces.
    let formattedBarcode = imageStatus.barcode.slice(0, 1) + " " + imageStatus.barcode.slice(1, 7) + " " + imageStatus.barcode.slice(7);

    // Display the results of barcode decoding.
    document.getElementById("barCodeText").innerHTML = formattedBarcode;
    document.getElementById("barCodeMsg").innerHTML  = imageStatus.message;

    // If the barcode of length 13 is returned, stop.
    if (imageStatus.barcode.length === 13)
    {
        stopDecoder(imageStatus.checksumValid);
    }

    context.strokeStyle = "red";
    context.fillStyle = "red";

    // Draw a horizontal lines showing the extent of the detected barcode.
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(imageStatus.startPixel, canvas.height / 2);
    context.lineTo(imageStatus.endPixel, canvas.height / 2);
    context.stroke();

    // Draw vertical lines showing the recognised barcode lines.
    let count = 0;
    let pixels = 0;
    for (let i = 0; i < imageStatus.areas.length; ++i)
    {
        if (pixels >= imageStatus.startPixel &&
            pixels + imageStatus.areas[i] - 1 <= imageStatus.endPixel)
        {
            if ((count % 2) === 0)
            {
                // Is a black bar, so display.
                context.fillRect(pixels,(canvas.height / 2) - 6, imageStatus.areas[i],12);
                context.fill();
            }
            count++;
        }
        pixels += imageStatus.areas[i];
    }

}

const STATE_BLACK = 0;
const STATE_WHITE = 1;

function getColor(r, g, b)
{
    let value = (r + g + b) / 3;
    return (value < 60) ? STATE_BLACK : STATE_WHITE;
}

function isSameColor(color1, color2)
{
    return color1 === color2;
}

function findBarcode(width, height, data)
{
    const logging = false;

    let offset       = height / 2;
    let start        = width * offset * 4;
    let end          = start + width * 4;
    let currentColor = getColor(data[start], data[start + 1], data[start + 2]);

    let areaWidths = [];
    let areaStates = [];

    // Performs a horizontal scan across the centre of the image and groups
    // the pixels into alternate white and black areas.  areasWidths is
    // an array that will hold the pixel width of each area.  areaStates
    // is an array of the same length that denotes whether each area is
    // recognised as white or black.
    let i = start;
	let count;
    while (i < end)
    {
        count = 0;
        while (i < end && (isSameColor(getColor(data[i], data[i + 1], data[i + 2]), currentColor)))
        {
            count++;
            i += 4;
        }
        areaWidths.push(count);
        areaStates.push(currentColor);
        if (i < end)
        {
            currentColor = getColor(data[i], data[i + 1], data[i + 2]);
        }
    }


    // Scans the areaWidths array from the left to determine the front
    // guard, a long white area followed by black-white-black areas of
    // similar short width.
    let startIndex = 0;
	let n2width;
    for (let n = startIndex; n < areaWidths.length - 4; ++n)
    {
        if (areaStates[n] === STATE_WHITE)
        {
            n2width = areaWidths[n + 2];
            if ((Math.abs(areaWidths[n + 1] - n2width) <= 5) &&
                (Math.abs(areaWidths[n + 3] - n2width) <= 5) &&
                ((areaWidths[n] - n2width) >= 20))
            {
                startIndex = n;
                break;
            }
        }
    }

    // Scans the areaWidths array backwards from the right to determine the
    // end guard, black-white-black areas of similar short width, followed
    // by a long white area.
    let endIndex = areaWidths.length - 1;
    for (let n = endIndex; n > 4; --n)
    {
        if (areaStates[n] === STATE_WHITE)
        {
            n2width = areaWidths[n - 2];
            if ((Math.abs(areaWidths[n - 1] - n2width) <= 5) &&
                (Math.abs(areaWidths[n - 3] - n2width) <= 5) &&
                ((areaWidths[n] - n2width) >= 20))
            {
                endIndex = n;
                break;
            }
        }
    }

    // Determine the pixel where the front guard starts.
    let pixelCount = 0;
    for (let i = 0; i <= startIndex; ++i)
    {
        pixelCount += areaWidths[i];
    }
    let startPixel = pixelCount;

    // Determine the pixel where the end guard ends.
    pixelCount = 0;
    for (let i = areaWidths.length - 1; i >= endIndex; --i)
    {
        pixelCount += areaWidths[i];
    }
    let endPixel = width - 1 - pixelCount;

    let barcodePixelWidth = endPixel - startPixel + 1;
    let areaWidth = barcodePixelWidth / 95;

    // Devide the available space into 95 areas and compute the
    // average colour for that area.
    let areaValues = [];
    let areaStart = start + startPixel * 4 ;
    let areaEnd = start + endPixel * 4;
    for (let i = 0, values, value,begin; i < 95; ++i)
    {
        values = 0
        begin = areaStart + Math.round(i * areaWidth) * 4;
        for (let r = begin; r < begin + Math.round(areaWidth) * 4; r += 4)
        {
            values += data[r] + data[r + 1] + data[r + 2];
        }
        value = values / Math.round(areaWidth) / 3;
        areaValues.push(Math.round(value));
    }

    if (logging)
    {
        console.log(areaWidths);
        console.log("startIndex: "+ startIndex + " startPixel: " + startPixel);
        console.log("endIndex: "+ endIndex + " endPixel: " + endPixel);
        console.log("Barcode width: " + barcodePixelWidth + " area width: " + areaWidth.toFixed(3));
        console.log("Values: " + areaValues);
    }

    let decodeResult;

    // Try three different threshold values for determining blck vs. white.
    // Compute the areas states for each and send to user's getCode function.
    let darknessThesholds = [120, 80, 100];

    for (let thesholdIndex in darknessThesholds)
    {
        let areaStates = "";

        for (let i = 0; i < 95; ++i)
        {
            let value = areaValues[i];
            let theshold = darknessThesholds[thesholdIndex];
            let state = (value > 100) ? 0 : 1;
            areaStates += String(state);
        }
        if (logging)
        {
            console.log("Areas: " + areaStates);
        }

        if (typeof decodeBarcodeFromAreas != 'function')
        {
            console.log("Error: Can't find decodeBarcodeFromAreas function.")
            return null;
        }

        decodeResult = decodeBarcodeFromAreas(areaStates);

        if ((typeof decodeResult !== 'object') || (decodeResult === null))
        {
            console.log("Error: decodeBarcodeFromAreas does not return an object.");
            return null;
        }
        else if (decodeResult.barcode === undefined)
        {
            console.log("Error: Object returned by decodeBarcodeFromAreas doesn't have a 'barcode' property.");
            return null;
        }
        else if (decodeResult.message === undefined)
        {
            console.log("Error: Object returned by decodeBarcodeFromAreas doesn't have a 'message' property.");
            return null;
        }
        else if (decodeResult.checksumValid === undefined)
        {
            console.log("Error: Object returned by decodeBarcodeFromAreas doesn't have a 'checksumValid' property.");
	    return null;
        }

        if (decodeResult.checksumValid)
        {
            // Stop if we've found a valid barcode.
            break;
        }
    }

    // Report back the results.
    let imageStatus = {
        barcode: String(decodeResult.barcode),
        message: String(decodeResult.message),
        checksumValid: Boolean(decodeResult.checksumValid),
        startPixel: startPixel,
        endPixel: endPixel,
        areas: areaWidths
    };

    return imageStatus;
}

function resetDecoder()
{
    clearInterval(capturingIntervalID); //clear Interval if exist
    capturingIntervalID                                   = setInterval(snapshot, unitTime);
    document.getElementById("barCodeText").innerHTML      = "";
    document.getElementById("barCodeMsg").innerHTML       = "";
    document.getElementById("spinner").style.display      = 'block';
    document.getElementById("codeValidity").style.display = 'none';
}

function stopDecoder(barcodeValid)
{
    clearInterval(capturingIntervalID);
    document.getElementById("spinner").style.display      = 'none';
    document.getElementById("codeValidity").style.display = 'block';
    if (barcodeValid)
    {
        document.getElementById("codeValidity").className = "circle green";
    }
    else
    {
        document.getElementById("codeValidity").className = "circle red";
    }
}

function displayMessage(message, timeout)
{
    if (timeout === undefined)
    {
        // Timeout argument not specifed, use default.
        timeout = 1000;
    }

    if (typeof(message) == 'number')
    {
        // If argument is a number, convert to a string.
        message = message.toString();
    }

    if (typeof(message) != 'string')
    {
        console.log("displayMessage: Argument is not a string.");
        return;
    }

    if (message.length == 0)
    {
        console.log("displayMessage: Given an empty string.");
        return;
    }

    let snackbarContainer = document.getElementById('toast');
    let data = {
        message: message,
        timeout: timeout
    };
    if (snackbarContainer && snackbarContainer.hasOwnProperty("MaterialSnackbar"))
    {
        snackbarContainer.MaterialSnackbar.showSnackbar(data);
    }
};

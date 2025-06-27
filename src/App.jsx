import React, { useEffect, useRef, useState } from "react";
import {
  Search,
  MapPin,
  Send,
  Trash2,
  Info,
  Camera,
  User,
  Mail,
  Phone,
} from "lucide-react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";

// Import CSS files
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

const App = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const draw = useRef(null);
  const [lng, setLng] = useState(-74.5);
  const [lat, setLat] = useState(40);
  const [zoom, setZoom] = useState(9);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAddress, setSelectedAddress] = useState("");
  const [roofCoordinates, setRoofCoordinates] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const [roofImage, setRoofImage] = useState(null);
  const [isCapturingImage, setIsCapturingImage] = useState(false);

  // New contact fields
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Replace with your actual Mapbox token
  const MAPBOX_TOKEN =
    "pk.eyJ1Ijoic2FtLW5pcnZhbmEiLCJhIjoiY21iNWNscGdwMDlkbzJqcXMwN2tlMDBmcSJ9.-HYpRdFSd_dGCidq1_6ZlQ";

  useEffect(() => {
    initializeMap();

    return () => {
      if (map.current) map.current.remove();
    };
  }, []);

  const initializeMap = () => {
    if (!mapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [lng, lat],
      zoom: zoom,
      preserveDrawingBuffer: true, // This is important for capturing images
    });

    // Initialize drawing tools
    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
      defaultMode: "draw_polygon",
    });

    map.current.addControl(draw.current);

    // Listen for drawing events
    map.current.on("draw.create", updateRoofCoordinates);
    map.current.on("draw.delete", updateRoofCoordinates);
    map.current.on("draw.update", updateRoofCoordinates);

    map.current.on("move", () => {
      setLng(map.current.getCenter().lng.toFixed(4));
      setLat(map.current.getCenter().lat.toFixed(4));
      setZoom(map.current.getZoom().toFixed(2));
    });
  };

  const updateRoofCoordinates = () => {
    if (!draw.current) return;

    const data = draw.current.getAll();
    if (data.features.length > 0) {
      const polygon = data.features[0];
      setRoofCoordinates(polygon.geometry.coordinates[0]);
      // Automatically capture image when roof is drawn
      setTimeout(() => captureRoofImage(), 500);
    } else {
      setRoofCoordinates(null);
      setRoofImage(null);
    }
  };

  const captureRoofImage = () => {
    if (!map.current) return;

    setIsCapturingImage(true);

    try {
      // Get the canvas from the map
      const canvas = map.current.getCanvas();

      // Convert canvas to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            // Convert blob to base64
            const reader = new FileReader();
            reader.onloadend = () => {
              setRoofImage(reader.result);
              setIsCapturingImage(false);
              // Toast notification would go here
            };
            reader.readAsDataURL(blob);
          } else {
            setIsCapturingImage(false);
            // Error toast would go here
          }
        },
        "image/png",
        0.8
      );
    } catch (error) {
      console.error("Error capturing image:", error);
      setIsCapturingImage(false);
      // Error toast would go here
    }
  };

  const searchAddress = async () => {
    if (!searchQuery.trim()) return;

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          searchQuery
        )}.json?access_token=${MAPBOX_TOKEN}&types=address`
      );

      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const [longitude, latitude] = feature.center;

        setSelectedAddress(feature.place_name);

        if (map.current) {
          map.current.flyTo({
            center: [longitude, latitude],
            zoom: 18,
            duration: 2000,
          });
        }
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      setSubmitStatus("Error searching address. Please try again.");
    }
  };

  const clearDrawing = () => {
    if (draw.current) {
      draw.current.deleteAll();
      setRoofCoordinates(null);
      setRoofImage(null);
    }
  };

  const clearAll = () => {
    clearDrawing();
    setSelectedAddress("");
    setSearchQuery("");
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
  };

  const submitRoofData = async () => {
    if (!selectedAddress || !roofCoordinates) {
      setSubmitStatus("Please search for an address and draw your roof first.");
      return;
    }

    if (
      !customerName.trim() ||
      !customerEmail.trim() ||
      !customerPhone.trim()
    ) {
      setSubmitStatus(
        "Please fill in all contact information (name, email, phone)."
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus("");

    const submitData = {
      // Contact information
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),

      // Address and roof data
      address: selectedAddress,
      roofCoordinates: JSON.stringify(roofCoordinates),
      timestamp: new Date().toISOString(),
      mapCenter: JSON.stringify({
        lng: parseFloat(lng),
        lat: parseFloat(lat),
      }),
      roofImage: roofImage || "", // Include the base64 image data
      hasImage: roofImage ? "true" : "false",
    };

    console.log("submit data", submitData);

    try {
      const webhookUrl =
        "https://hooks.zapier.com/hooks/catch/22744726/2jzn64e/";

      // Convert to URL-encoded format
      const formData = new URLSearchParams();
      for (const key in submitData) {
        formData.append(key, submitData[key]);
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      console.log("Response:", response);

      if (response.ok) {
        setSubmitStatus("✅ Roof data and image submitted successfully!");
        clearAll();
      } else {
        throw new Error("Submission failed");
      }
    } catch (error) {
      console.error("Submission error:", error);
      setSubmitStatus("❌ Error submitting data. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b p-3 sm:p-4 md:p-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 mb-3 sm:mb-4 text-center">
          Draw My Roof
        </h1>

        {/* Contact Information */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3 sm:mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Your name..."
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-8 sm:pl-10"
            />
            <User className="absolute left-2 sm:left-3 top-2 sm:top-2.5 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          </div>
          <div className="relative">
            <input
              type="email"
              placeholder="Your email..."
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-8 sm:pl-10"
            />
            <Mail className="absolute left-2 sm:left-3 top-2 sm:top-2.5 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          </div>
          <div className="relative">
            <input
              type="tel"
              placeholder="Your phone..."
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-8 sm:pl-10"
            />
            <Phone className="absolute left-2 sm:left-3 top-2 sm:top-2.5 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          </div>
        </div>

        {/* Address Search */}
        <div className="flex flex-col sm:flex-row gap-2 mb-3 sm:mb-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Enter your address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && searchAddress()}
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Search className="absolute right-2 sm:right-3 top-2 sm:top-2.5 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          </div>
          <button
            onClick={searchAddress}
            className="px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors whitespace-nowrap"
          >
            Search
          </button>
        </div>

        {/* Selected Address */}
        {selectedAddress && (
          <div className="flex items-start sm:items-center gap-2 p-2 sm:p-3 bg-green-50 border border-green-200 rounded-lg mb-3 sm:mb-4">
            <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5 sm:mt-0" />
            <span className="text-green-800 text-xs sm:text-sm leading-tight break-words">
              {selectedAddress}
            </span>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="flex-1 relative min-h-0">
        <div ref={mapContainer} className="w-full h-full" />

        {/* Map Info */}
        <div className="absolute top-2 sm:top-4 left-2 sm:left-4 bg-white bg-opacity-90 backdrop-blur-sm p-1.5 sm:p-2 rounded shadow-md text-xs">
          <div className="hidden sm:block">
            Lng: {lng} | Lat: {lat} | Zoom: {zoom}
          </div>
          <div className="sm:hidden">
            {lng}, {lat}
          </div>
        </div>

        {/* Capture Image Button */}
        {/* <div className="absolute top-2 sm:top-4 right-2 sm:right-4 ">
          <button
            onClick={captureRoofImage}
            disabled={isCapturingImage}
            className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-blue-600 text-white rounded shadow-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            <Camera className="h-3 w-3 sm:h-4 sm:w-4" />
            {isCapturingImage ? "Capturing..." : "Capture"}
          </button>
        </div> */}
      </div>

      {/* Bottom Controls */}
      <div className="bg-white border-t p-3 sm:p-4 md:p-6">
        {/* Image Preview */}
        {roofImage && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Camera className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                Roof Image Captured
              </span>
            </div>
            <img
              src={roofImage}
              alt="Captured roof"
              className="w-full max-w-xs h-auto rounded border"
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
          <button
            onClick={clearDrawing}
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base bg-gray-600 text-white rounded-lg hover:bg-gray-700 active:bg-gray-800 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Clear Drawing</span>
            <span className="sm:hidden">Clear</span>
          </button>

          <button
            onClick={captureRoofImage}
            disabled={isCapturingImage || !roofCoordinates}
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:bg-purple-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <Camera className="h-4 w-4" />
            {isCapturingImage ? (
              <>
                <span className="hidden sm:inline">Capturing...</span>
                <span className="sm:hidden">Wait...</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Capture Image</span>
                <span className="sm:hidden">Capture</span>
              </>
            )}
          </button>

          <button
            onClick={submitRoofData}
            disabled={isSubmitting || !selectedAddress || !roofCoordinates}
            className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
            {isSubmitting ? (
              <>
                <span className="hidden sm:inline">Submitting...</span>
                <span className="sm:hidden">Sending...</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Submit Roof Data</span>
                <span className="sm:hidden">Submit</span>
              </>
            )}
          </button>
        </div>

        {/* Status Message */}
        {submitStatus && (
          <div className="mt-3 p-2 sm:p-3 bg-gray-50 border rounded-lg text-center text-xs sm:text-sm">
            {submitStatus}
          </div>
        )}

        {/* Roof Coordinates Preview */}
        {roofCoordinates && (
          <div className="mt-3 p-2 sm:p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs sm:text-sm font-medium text-yellow-800 mb-2">
              Roof Outline Captured ({roofCoordinates.length} points)
              {roofImage && " + Image 📷"}
            </p>
            <div className="text-xs text-yellow-700 max-h-16 sm:max-h-20 overflow-y-auto break-all">
              {roofCoordinates.map((coord, idx) => (
                <span key={idx} className="inline-block mr-1">
                  [{coord[0].toFixed(6)}, {coord[1].toFixed(6)}]
                  {idx < roofCoordinates.length - 1 ? ", " : ""}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;

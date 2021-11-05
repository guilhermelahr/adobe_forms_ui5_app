/* global QUnit */

QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function() {
	"use strict";

	sap.ui.require([
		"com/wb/adobe/adobeform01/test/integration/AllJourneys"
	], function() {
		QUnit.start();
	});
});
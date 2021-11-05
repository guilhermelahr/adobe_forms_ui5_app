sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"../model/formatter",
	"sap/m/PDFViewer"
], function (BaseController, JSONModel, History, formatter, PDFViewer) {
	"use strict";

	return BaseController.extend("com.wb.adobe.adobeform01.controller.Object", {

		formatter: formatter,

		/* =========================================================== */
		/* My custom code goes here                                    */
		/* =========================================================== */

		onDisplay: function () {
			this._RenderPDF("Auto");
		},

		onDownload: function () {
			this._RenderPDF("Link");
		},

		_xmlContentFromContext: function () {

			var oData = this.getView().getBindingContext().getObject({
				expand: "Customer,Order_Details"
			});

			var oChild,
				oTagChild,
				iUnitPrice;

			var oXMLDoc = document.implementation.createDocument(null, "form1", null);

			var oTag = oXMLDoc.documentElement.appendChild(oXMLDoc.createElement("Field1"));
			oTag.textContent = oData.OrderID;

			oTag = oXMLDoc.documentElement.appendChild(oXMLDoc.createElement("Field2"));
			oTag.textContent = oData.OrderDate.toLocaleDateString();

			oTag = oXMLDoc.documentElement.appendChild(oXMLDoc.createElement("Field3"));
			oTag.textContent = oData.ShippedDate.toLocaleDateString();

			//Items
			oTag = oXMLDoc.documentElement.appendChild(oXMLDoc.createElement("Items"));

			if (oData.Order_Details.length > 0) {

				oData.Order_Details.forEach(function (oDetail) {

					oChild = oTag.appendChild(oXMLDoc.createElement("Item"));

					oTagChild = oChild.appendChild(oXMLDoc.createElement("ItemNumber"));
					oTagChild.textContent = oDetail.ProductID;

					oTagChild = oChild.appendChild(oXMLDoc.createElement("ItemField1"));
					oTagChild.textContent = oDetail.UnitPrice;
					iUnitPrice = parseInt(oDetail.UnitPrice);

					oTagChild = oChild.appendChild(oXMLDoc.createElement("ItemField2"));
					oTagChild.textContent = oDetail.Quantity.toString();

					oTagChild = oChild.appendChild(oXMLDoc.createElement("ItemField3"));
					oTagChild.textContent = iUnitPrice * oDetail.Quantity;

				});

			}

			return new XMLSerializer().serializeToString(oXMLDoc);

		},

		_RenderPDF: function (sDiplayType) {

			//Sample data in model file
			//var sXMLData = '<?xml version="1.0" encoding="UTF-8"?>' + this.oXMLModel.getXML();

			//Get data from odata model
			var sXMLData = '<?xml version="1.0" encoding="UTF-8"?>' + this._xmlContentFromContext();

			var encdata = btoa(sXMLData);

			//Form and template name -  see Template Store UI
			var jsondata = "{  " + "\"xdpTemplate\": \"" + "Deal_Wizard_Form/DealWizardForm" + "\", " + "\"xmlData\": \"" + encdata + "\"}";

			$.ajax({
				url: "/ADS/v1/adsRender/pdf?templateSource=storageName",
				type: "POST",
				method: "POST",
				contentType: "application/json",
				data: jsondata,
				success: function (data, textStatus, jqXHR) {

					var decodedPdfContent = atob(data.fileContent);

					var byteArray = new Uint8Array(decodedPdfContent.length);

					for (var i = 0; i < decodedPdfContent.length; i++) {
						byteArray[i] = decodedPdfContent.charCodeAt(i);
					}
					var blob = new Blob([byteArray.buffer], {
						type: 'application/pdf'
					});
					var _pdfurl = URL.createObjectURL(blob);

					if (!this._PDFViewer) {
						this._PDFViewer = new sap.m.PDFViewer({
							width: "auto",
							source: _pdfurl,
							displayType: sDiplayType
						});
						jQuery.sap.addUrlWhitelist("blob"); // register blob url as whitelist
					}

					this._PDFViewer.open();

				},
				error: function (data) {

				}
			});
		},

		/* =========================================================== */
		/* End of custom code                                          */
		/* =========================================================== */

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function () {
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var iOriginalBusyDelay,
				oViewModel = new JSONModel({
					busy: true,
					delay: 0
				});

			this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);

			// Store original busy indicator delay, so it can be restored later on
			iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();
			this.setModel(oViewModel, "objectView");
			this.getOwnerComponent().getModel().metadataLoaded().then(function () {
				// Restore original busy indicator delay for the object view
				oViewModel.setProperty("/delay", iOriginalBusyDelay);
			});

			//Custom code - Load XML file
			var appId = this.getOwnerComponent().getManifestEntry("/sap.app/id");
			var appPath = appId.replaceAll(".", "/");
			var sPath = jQuery.sap.getModulePath(appPath, "/model/data.xml");
			this.oXMLModel = new sap.ui.model.xml.XMLModel(sPath);
			//End of custom code

		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Event handler  for navigating back.
		 * It there is a history entry we go one step back in the browser history
		 * If not, it will replace the current entry of the browser history with the worklist route.
		 * @public
		 */
		onNavBack: function () {
			var sPreviousHash = History.getInstance().getPreviousHash();

			if (sPreviousHash !== undefined) {
				history.go(-1);
			} else {
				this.getRouter().navTo("worklist", {}, true);
			}
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			var sObjectId = oEvent.getParameter("arguments").objectId;
			this.getModel().metadataLoaded().then(function () {
				var sObjectPath = this.getModel().createKey("Orders", {
					OrderID: sObjectId
				});
				this._bindView("/" + sObjectPath);
			}.bind(this));
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound
		 * @private
		 */
		_bindView: function (sObjectPath) {
			var oViewModel = this.getModel("objectView"),
				oDataModel = this.getModel();

			this.getView().bindElement({
				path: sObjectPath,
				parameters: {
					expand: "Customer,Order_Details"
				},
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function () {
						oDataModel.metadataLoaded().then(function () {
							// Busy indicator on view should only be set if metadata is loaded,
							// otherwise there may be two busy indications next to each other on the
							// screen. This happens because route matched handler already calls '_bindView'
							// while metadata is loaded.
							oViewModel.setProperty("/busy", true);
						});
					},
					dataReceived: function () {
						oViewModel.setProperty("/busy", false);
					}
				}
			});
		},

		_onBindingChange: function () {
			var oView = this.getView(),
				oViewModel = this.getModel("objectView"),
				oElementBinding = oView.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("objectNotFound");
				return;
			}

			var oResourceBundle = this.getResourceBundle(),
				oObject = oView.getBindingContext().getObject(),
				sObjectId = oObject.OrderID,
				sObjectName = oObject.ShippedDate;

			oViewModel.setProperty("/busy", false);

			oViewModel.setProperty("/shareSendEmailSubject",
				oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
			oViewModel.setProperty("/shareSendEmailMessage",
				oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));
		}

	});

});
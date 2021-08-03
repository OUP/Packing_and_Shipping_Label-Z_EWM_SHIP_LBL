sap.ui.define(
  ["./BaseController", "sap/ui/model/json/JSONModel"],
  function (BaseController, JSONModel) {
    "use strict";

    return BaseController.extend("oup.ewm.zewmshiplbl.controller.App", {
      onInit: function () {
        var oViewModel,
          fnSetAppNotBusy,
          iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();

        oViewModel = new JSONModel({
          busy: true,
          delay: 0,
        });
        this.setModel(oViewModel, "appView");

        const oDataModel = this.getOwnerComponent().getModel();

        fnSetAppNotBusy = function () {
          oViewModel.setProperty("/busy", false);
          oViewModel.setProperty("/delay", iOriginalBusyDelay);
        };

        // disable busy indication when the metadata is loaded and in case of errors

        oDataModel.metadataLoaded().then(fnSetAppNotBusy);
        oDataModel.attachMetadataFailed(fnSetAppNotBusy);

        // apply content density mode to root view
        this.getView().addStyleClass(
          this.getOwnerComponent().getContentDensityClass()
        );
      },
    });
  }
);

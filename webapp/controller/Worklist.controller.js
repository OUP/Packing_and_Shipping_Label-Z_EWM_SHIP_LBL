sap.ui.define(
  [
    "./BaseController",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "../model/formatter",
  ],
  function (BaseController, MessageBox, JSONModel, Fragment, formatter) {
    "use strict";

    // global fields
    let _oView = null;
    let _oTable = null;
    let _oRadioBtn = null;
    let _oRadioBtnContainer = null;
    let _oPageHeaderContainer = null;
    let _oPageContainer = null;
    let _oViewModel = new JSONModel({ edit: false });
    let _aTableItems = [];
    let _guid = "";
    const _sDeferredGroup = new Date().getTime().toString();

    return BaseController.extend("oup.ewm.zewmshiplbl.controller.Worklist", {
      formatter: formatter,

      /* =========================================================== */
      /* lifecycle methods                                           */
      /* =========================================================== */

      /**
       * Called when the worklist controller is instantiated.
       * @public
       */
      onInit: function () {
        _oView = this.getView();
        _oRadioBtnContainer = _oView.byId("dynamic-radio-btn-id");
        _oPageHeaderContainer = _oView.byId("dynamic-header-container-id");
        _oPageContainer = _oView.byId("dyanmic-page-content-id");

        // oData model
        this.getOwnerComponent()
          .getModel()
          .setDeferredGroups([_sDeferredGroup]);

        // view model
        this.setModel(_oViewModel, "oViewModel");

        // load radio button and assign it to container
        this._loadRadioBtn(this);
      },

      /* =========================================================== */
      /* event handlers                                              */
      /* =========================================================== */

      onRadioBtnSelectChange: async function (oEvent) {
        try {
          const oSource = oEvent.getSource();
          const oSelectedButtonSource = oSource.getSelectedButton();
          const sTarget = oSelectedButtonSource.data("target");

          if (sTarget !== "ShipLabel") {
            return;
          }

          // destroy the container if already available
          _oPageHeaderContainer.destroyItems();
          _oPageContainer.destroyItems();

          // load filter content based on radio button selection
          const oFilterFragment = await this._loadFragment(
            `oup.ewm.zewmshiplbl.view.fragment.${sTarget}_Filter`,
            this
          );

          // load table content based on radio button selection
          const oTableFragment = await this._loadFragment(
            `oup.ewm.zewmshiplbl.view.fragment.${sTarget}_Table`,
            this
          );

          // add fragment to page header
          _oPageHeaderContainer.addItem(oFilterFragment);

          // add fragment to page container
          _oPageContainer.addItem(oTableFragment);

          // change the table column size
          _oTable = oTableFragment.getItems()[0];

          // add event delegate for onafter rendering
          _oTable.addEventDelegate({
            onAfterRendering: (oContext) => {
              try {
                const oSmartTable = oContext.srcControl;
                const aColumns = oSmartTable.getColumns();

                for (const oColumn of aColumns) {
                  const sProperty = oColumn.getFilterProperty();
                  let sWidth = "10em";

                  if (
                    sProperty === "ProductDesc" ||
                    sProperty === "OdoQuantity"
                  ) {
                    sWidth = "15em";
                  } else if (sProperty === "Pallet") {
                    sWidth = "4em";
                  }
                  oColumn.setWidth(sWidth);
                }
              } catch (error) {}
            },
          });

          // end busy indicator
          sap.ui.core.BusyIndicator.hide();
        } catch (error) {
          // failed to load filter and table in page header & container

          // end busy indicator
          sap.ui.core.BusyIndicator.hide();
        }
      },

      onBeforeRebindTable: function (oEvent) {
        const mBindingParams = oEvent.getParameter("bindingParams");

        //Event handlers for the binding
        mBindingParams.events = {
          dataReceived: (oEvent) => {
            const aReceivedData = oEvent.getParameter("data");
            _aTableItems = aReceivedData.results;

            // create new guid instance
            _guid = this.uuidv4();
          },
        };
      },

      onPalletRecalcualatePress: function (oEvent) {
        const fnOnConfirmation = () => {
          // start busy indicator
          sap.ui.core.BusyIndicator.show(0);

          // group data by ship to party
          var oGrouped = this.groupBy("ShipToPartyNo");

          // odata model
          const oDataModel = _oView.getModel();

          // temp counter
          let iTempCounter = 0;

          // loop groupped pallet no.
          for (const oProp in oGrouped) {
            // console.log(`${oProp}: ${oGrouped[oProp]}`);
            const aData = oGrouped[oProp];

            // calculate pallet no.
            // threshold is 36
            let iCounter = 0;
            for (const [index, oData] of aData.entries()) {
              if (index % 36 === 0) iCounter++;

              // update pallent no.
              oData.Pallet = iCounter;

              // create payload
              const oEntry = {
                ZreqNo: _guid,
                Docno: oData.OutboundDeliveryOrder,
                Itemno: oData.OutboundDeliveryOrderItem,
                Carton: oData.Carton,
                Pallet: oData.Pallet.toString(),
                Sequence: iTempCounter.toString(),
                Qty: oData.OdoQuantity,
                Uom: oData.OdoUom,
                Product: oData.ProductNumber,
                ShipTo: oData.ShipToPartyNo,
              };

              // increment temp counter
              iTempCounter++;

              // create payload
              oDataModel.create("/OdoPalletNumSet", oEntry, {
                groupId: _sDeferredGroup,
              });
            }
          }

          const mParameters = {
            groupId: _sDeferredGroup,
            success: (_oData, _oResp) => {
              // refresh table
              _oTable.getModel().refresh();

              // end busy indicator
              sap.ui.core.BusyIndicator.hide();
            },
            error: (_oData, _oResp) => {
              // end busy indicator
              sap.ui.core.BusyIndicator.hide();
            },
          };

          // submit changes
          oDataModel.submitChanges(mParameters);
        };

        // display warning message
        MessageBox.warning("Confirm to recalculate pallet no. ?", {
          actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
          emphasizedAction: MessageBox.Action.OK,
          styleClass: "sapUiSizeCompact",
          onClose: (sAction) => {
            if (sAction === MessageBox.Action.OK) {
              fnOnConfirmation();
            }
          },
        });
      },

      onSavePress: async function (_oEvent) {
        try {
          // start busy indicator
          sap.ui.core.BusyIndicator.show(0);

          // const oSource = oEvent.getSource();
          // const sTarget = oSource.data("target");

          if (!_oView.getModel().hasPendingChanges()) {
            // display warning message
            MessageBox.information("There are no changes found to save", {
              styleClass: "sapUiSizeCompact",
            });

            throw "no changes found";
          }

          await this._saveChanges();

          // toggle edit property in view model
          _oViewModel.setProperty("/edit", false);
        } catch (error) {
          // failed to save changes

          // end busy indicator
          sap.ui.core.BusyIndicator.hide();
        }
      },

      onPrintPress: () => {
        const guid = _aTableItems[0].Guid || _guid;
        sap.m.URLHelper.redirect(
          `${window.location.origin}/sap/opu/odata/sap/ZEWMSHIPLABEL_SRV/OdoPdfSet(guid'${guid}')/$value`,
          true
        );
      },

      // toggle edit property in view model
      onEditPress: () => _oViewModel.setProperty("/edit", true),

      onCancelPress: () => {
        if (_oView.getModel().hasPendingChanges()) {
          // display warning message
          MessageBox.warning("Cancel your changes ?", {
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            emphasizedAction: MessageBox.Action.OK,
            styleClass: "sapUiSizeCompact",
            onClose: (sAction) => {
              if (sAction === MessageBox.Action.OK) {
                // cancel the changes by resetting the model
                _oView.getModel().resetChanges();

                // toggle edit property in view model
                _oViewModel.setProperty("/edit", false);
              }
            },
          });
        } else {
          // toggle edit property in view model
          _oViewModel.setProperty("/edit", false);
        }
      },

      /* =========================================================== */
      /* internal methods                                            */
      /* =========================================================== */

      _loadRadioBtn: async (oThis) => {
        try {
          // start busy indicator
          sap.ui.core.BusyIndicator.show(0);

          // load filter content based on radio button selection
          const oFragment = await oThis._loadFragment(
            `oup.ewm.zewmshiplbl.view.fragment.RadioBtn`,
            oThis
          );

          // add radio button to container
          _oRadioBtnContainer.addItem(oFragment);

          // get radio button from container
          _oRadioBtn = sap.ui.getCore().byId("radio-btn-group-id");

          // get shipping label button instance
          _oRadioBtn.setSelectedButton(_oRadioBtn.getAggregation("buttons")[2]);

          // force select the first radio button
          _oRadioBtn.fireSelect({
            selectedIndex: 2, // shipping label
          });
        } catch (error) {
          // failed to load radio button in to page title container

          // end busy indicator
          sap.ui.core.BusyIndicator.hide();
        }
      },

      _loadFragment: (sPath, oThis) =>
        new Promise((reslove, reject) =>
          Fragment.load({
            name: sPath,
            controller: oThis,
          })
            .then((oFragment) => reslove(oFragment))
            .catch((oError) => reject(oError))
        ),

      _saveChanges: () =>
        new Promise((reslove, reject) => {
          const fnSuccess = (oDataResponse) => {
            try {
              // check for odata response status code
              const bError =
                oDataResponse.__batchResponses[0].response.statusCode !== "200";
              if (bError) {
                throw "error";
              }

              // if no errors, resolve the promise
              reslove(oDataResponse);
            } catch (error) {
              // error in odata request
              reject("Failed to save the changes");
            }
          };

          const fnError = (oErrorResponse) => {
            reject(oErrorResponse);
          };

          _oView.getModel().submitChanges({
            success: fnSuccess,
            error: fnError,
          });
        }),

      uuidv4: () =>
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          let r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }),

      groupBy: (sProperty) =>
        _aTableItems.reduce((r, a) => {
          r[a[sProperty]] = [...(r[a[sProperty]] || []), a];
          return r;
        }, {}),
    });
  }
);

// register blob url as whitelist
jQuery.sap.addUrlWhitelist("blob");

sap.ui.define(
  [
    "./BaseController",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "../model/formatter",
  ],
  function (
    BaseController,
    MessageBox,
    MessageToast,
    JSONModel,
    Fragment,
    formatter
  ) {
    "use strict";

    // global fields
    let _oView = null;
    let _oTable = null;
    let _oRadioBtn = null;
    let _oRadioBtnContainer = null;
    let _oPageHeaderContainer = null;
    let _oPageContainer = null;
    let _oThis = null;
    let _aTableItems = [];
    let _guid = "";
    let _oPrintePreviewDialog;
    let _oRowSelected = null;
    let _oDomModel = null;
    let _bColumnOptimizationDone = false;
    let _oViewModel = new JSONModel({
      edit: false,
      tableTitle: "",
      pdfDialogTitle: "",
      pdfSourceURI: "",
    });
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
        _oThis = this;

        // dom model
        _oDomModel = this.getOwnerComponent().getModel("dom");

        // oData model
        const oModel = this.getOwnerComponent().getModel();
        const oChangeGroups = oModel.getChangeGroups();
        oChangeGroups._sDeferredGroup = { groupId: _sDeferredGroup };
        oModel.setChangeGroups(oChangeGroups);

        const aDeferredGroups = oModel.getDeferredGroups();
        aDeferredGroups.push(_sDeferredGroup);
        oModel.setDeferredGroups(aDeferredGroups);

        // view model
        this.setModel(_oViewModel, "oViewModel");

        // load radio button and assign it to container
        this._loadRadioBtn();
      },

      /* =========================================================== */
      /* event handlers                                              */
      /* =========================================================== */

      onRadioBtnSelect: (oEvent) => {
        // get selected index
        const iSelectedIndex = oEvent.getParameter("selectedIndex");

        // for default index val '0'
        let sTitlePath = "worklistRadioBtnPackingListDomestic";

        // load title dynamically
        if (iSelectedIndex === 1) {
          sTitlePath = "worklistRadioBtnPackingListExport";
        } else if (iSelectedIndex === 2) {
          sTitlePath = "worklistRadioBtnShippingLabel";
        }

        // set title
        _oViewModel.setProperty(
          "/tableTitle",
          _oThis.getResourceBundle().getText(sTitlePath)
        );

        // load page content
        _oThis._laodPageContent(iSelectedIndex === 0 ? "Dom" : "Ship");
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

      onSavePress: async function (_oEvent) {
        try {
          // start busy indicator
          sap.ui.core.BusyIndicator.show(0);

          if (!_oView.getModel().hasPendingChanges()) {
            // toggle edit property in view model
            _oViewModel.setProperty("/edit", false);

            // display warning message
            // MessageBox.information("There are no changes found to save", {
            //   styleClass: "sapUiSizeCompact",
            // });

            throw "no changes found";
          }

          await this._saveChanges();

          // toggle edit property in view model
          _oViewModel.setProperty("/edit", false);

          // end busy indicator
          sap.ui.core.BusyIndicator.hide();
        } catch (error) {
          // failed to save changes

          // end busy indicator
          sap.ui.core.BusyIndicator.hide();
        }
      },

      onDomPrintPress: async () => {
        try {
          if (!_oPrintePreviewDialog) {
            // initialize dialog
            _oPrintePreviewDialog = await _oThis._loadFragment(
              `oup.ewm.zewmshiplbl.view.fragment.PreviewPDF`
            );

            // add view dependent
            _oView.addDependent(_oPrintePreviewDialog);
          }

          // success call back
          const success = (oDataResponse) => {
            const base64EncodedPDF = oDataResponse.FileContent;
            const decodedPdfContent = atob(base64EncodedPDF);
            const byteArray = new Uint8Array(decodedPdfContent.length);
            for (let i = 0; i < decodedPdfContent.length; i++) {
              byteArray[i] = decodedPdfContent.charCodeAt(i);
            }
            const blob = new Blob([byteArray.buffer], {
              type: "application/pdf",
            });
            const _pdfurl = URL.createObjectURL(blob);

            // title
            const sTitle = _oThis
              .getResourceBundle()
              .getText("worklistRadioBtnPackingListDomestic");
            _oViewModel.setProperty("/pdfDialogTitle", sTitle);

            // source uri
            _oViewModel.setProperty("/pdfSourceURI", _pdfurl);

            // open dialog
            _oPrintePreviewDialog.open();
          };

          // error call back
          const error = (_oErrorResponse) => {
            throw "Error";
          };

          // property used in the payload
          let sSalesOrders = "";

          for (const oItem of _aTableItems) {
            sSalesOrders += oItem.SalesOrder + "|";
          }

          // remove the last pipe
          if (sSalesOrders.length > 0) {
            sSalesOrders = sSalesOrders.substring(0, sSalesOrders.length - 1);
          }

          _oDomModel.create(
            `/OdoPdfSet`,
            { SalesOrders: sSalesOrders },
            {
              success,
              error,
            }
          );
        } catch (error) {
          // error message
          MessageToast.show("No Data Found !");
        }
      },

      onPrintPress: async () => {
        try {
          if (!_oPrintePreviewDialog) {
            // initialize dialog
            _oPrintePreviewDialog = await _oThis._loadFragment(
              `oup.ewm.zewmshiplbl.view.fragment.PreviewPDF`
            );

            // add view dependent
            _oView.addDependent(_oPrintePreviewDialog);
          }

          // service url
          const sServiceURL = _oView.getModel().sServiceUrl;

          // form constant based on radio button selection
          const sFormConstant = _oRadioBtn.getSelectedButton().data("pdf");

          // temp
          const guid = _aTableItems[0].Guid || _guid;

          if (!guid) {
            throw "No Data Found !";
          }

          // set title
          let sTitle = "worklistRadioBtnShippingLabel";

          if (sFormConstant === "PACKDOM") {
            sTitle = "worklistRadioBtnPackingListDomestic";
          } else if (sFormConstant === "PACKEXP") {
            sTitle = "worklistRadioBtnPackingListExport";
          }

          // title
          _oViewModel.setProperty(
            "/pdfDialogTitle",
            _oThis.getResourceBundle().getText(sTitle)
          );

          // source uri
          _oViewModel.setProperty(
            "/pdfSourceURI",
            `${sServiceURL}/OdoPdfSet(FileID=guid'${guid}',Form='${sFormConstant}')/$value`
          );

          // open dialog
          _oPrintePreviewDialog.open();
        } catch (error) {
          // error message
          MessageToast.show("No Data Found !");
        }
      },

      closeDialog: () => _oPrintePreviewDialog.close(),

      onDownload: () => {
        const guid = _aTableItems[0].Guid || _guid;
        const sServiceURL = _oView.getModel().sServiceUrl;
        const sFormConstant = _oRadioBtn.getSelectedButton().data("pdf");

        sap.m.URLHelper.redirect(
          `${window.location.origin}${sServiceURL}/OdoPdfSet(FileID=guid'${guid}',Form='${sFormConstant}')/$value`,
          true
        );
      }, // toggle edit property in view model
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

      onCopyPress: () => {
        try {
          // validate row selection
          _oRowSelected = _oThis._validateTableRowSelection();

          if (!_oRowSelected) {
            throw "error";
          }

          // temp row
          const oTempRow = JSON.parse(JSON.stringify(_oRowSelected));

          // create new entry in table item by selected row
          oTempRow.OdoQuantity = "0";

          // insert to array
          _aTableItems.push(oTempRow);

          // save the changes
          _oThis.saveCopyDelete(true /* copy */);
        } catch (error) {}
      },

      onDeletePress: () => {
        try {
          // validate row selection
          _oRowSelected = _oThis._validateTableRowSelection();

          if (!_oRowSelected) {
            throw "error";
          }

          // delete entry in table item by selected row
          const iSelectedRowIndex = _aTableItems.findIndex(
            (obj) => obj.__metadata.id === _oRowSelected.__metadata.id
          );

          if (iSelectedRowIndex === -1) {
            throw "error";
          }

          // remove the selected row
          _aTableItems.splice(iSelectedRowIndex, 1);

          // save the changes
          _oThis.saveCopyDelete(false /* copy */);
        } catch (error) {}
      },

      /* =========================================================== */
      /* internal methods                                            */
      /* =========================================================== */

      _loadRadioBtn: async () => {
        try {
          // start busy indicator
          sap.ui.core.BusyIndicator.show(0);

          // load filter content based on radio button selection
          const oFragment = await _oThis._loadFragment(
            `oup.ewm.zewmshiplbl.view.fragment.RadioBtn`
          );

          // add radio button to container
          _oRadioBtnContainer.addItem(oFragment);

          // get radio button from container
          _oRadioBtn = sap.ui.getCore().byId("radio-btn-group-id");

          // get shipping label button instance
          //   _oRadioBtn.setSelectedButton(_oRadioBtn.getAggregation("buttons")[0]);

          // trigger selection
          _oRadioBtn.fireSelect({ selectedIndex: 0 });
        } catch (error) {
          // failed to load radio button in to page title container

          // end busy indicator
          sap.ui.core.BusyIndicator.hide();
        }
      },

      _laodPageContent: async (sName) => {
        try {
          // destroy existing content
          _oPageHeaderContainer.destroyItems();
          _oPageContainer.destroyItems();

          // load filter content based on radio button selection
          const oFilterFragment = await _oThis._loadFragment(
            `oup.ewm.zewmshiplbl.view.fragment.${sName}_Filter`
          );

          // load table content based on radio button selection
          const oTableFragment = await _oThis._loadFragment(
            `oup.ewm.zewmshiplbl.view.fragment.${sName}_Table`
          );

          // add to page dependent
          _oView.addDependent(oFilterFragment);
          _oView.addDependent(oTableFragment);

          // set dom model for domestic
          if (sName === "Dom") {
            oFilterFragment.setModel(_oDomModel);
            oTableFragment.setModel(_oDomModel);
          }

          // add fragment to page header
          _oPageHeaderContainer.addItem(oFilterFragment);

          // add fragment to page container
          _oPageContainer.addItem(oTableFragment);

          // change the table column size
          _oTable = oTableFragment.getItems()[0];

          // reset the column optimization
          _bColumnOptimizationDone = false;

          // add event delegate for onafter rendering
          const _onSmartTableBusyStateChanged = (oEvent) => {
            const bBusy = oEvent.getParameter("busy");
            if (!bBusy && !_bColumnOptimizationDone) {
              let oTpc = null;
              if (sap.ui.table.TablePointerExtension) {
                oTpc = new sap.ui.table.TablePointerExtension(_oTable);
              } else {
                oTpc = new sap.ui.table.extensions.Pointer(_oTable);
              }
              const aColumns = _oTable.getColumns();
              for (let i = aColumns.length; i >= 0; i--) {
                oTpc.doAutoResizeColumn(i);
              }
              // columns not to be adjusted on every scroll
              _bColumnOptimizationDone = true;
            }
          };

          // add event delegate for onafter rendering
          _oTable.addEventDelegate({
            onAfterRendering: (_) =>
              _oTable.attachBusyStateChanged(_onSmartTableBusyStateChanged),
          });

          // end busy indicator
          sap.ui.core.BusyIndicator.hide();
        } catch (error) {
          // failed to load filter and table in page header & container

          // end busy indicator
          sap.ui.core.BusyIndicator.hide();
        }
      },

      _loadFragment: (sPath) =>
        new Promise((reslove, reject) =>
          Fragment.load({
            name: sPath,
            controller: _oThis,
          })
            .then((oFragment) => reslove(oFragment))
            .catch((oError) => reject(oError))
        ),

      _validateTableRowSelection: () => {
        try {
          const iSelectedIndex = _oTable.getSelectedIndex();

          if (iSelectedIndex === -1) {
            throw "error";
          }

          // get selected row from biniding context
          const oContext = _oTable.getContextByIndex(iSelectedIndex);
          const oData = oContext.getObject() || null;

          return oData;
        } catch (error) {
          MessageToast.show(
            _oThis.getResourceBundle().getText("worlistNoRowSelected")
          );
        }
      },

      _buildPayload: () => {
        const oModel = _oView.getModel();
        const oPendingChanges = oModel.getPendingChanges();
        const aKeys = Object.keys(oPendingChanges);

        for (const sKey of aKeys) {
          // search and update the table item
          for (let i = 0, iLen = _aTableItems.length; i < iLen; i++) {
            const oChange = oPendingChanges[sKey];

            if (_aTableItems[i].__metadata.id === oChange.__metadata.id) {
              // update quantity
              if (oChange.OdoQuantity !== undefined) {
                _aTableItems[i].OdoQuantity = oChange.OdoQuantity;
              }

              // update carton numbers
              if (oChange.Carton !== undefined) {
                _aTableItems[i].Carton = oChange.Carton;
              }
              break;
            }
          }
        }

        let aToPallet = [];

        for (const [index, oItem] of _aTableItems.entries()) {
          aToPallet.push({
            ZreqNo:
              oItem.Guid === "00000000-0000-0000-0000-000000000000"
                ? _guid
                : oItem.Guid,
            Docno: oItem.OutboundDeliveryOrder,
            Itemno: oItem.OutboundDeliveryOrderItem,
            Sequence: oItem.Sequence, // index.toString(), // incrementer
            ShipTo: oItem.ShipToPartyNo,
            Product: oItem.ProductNumber,
            Qty: oItem.OdoQuantity,
            Uom: oItem.OdoUom,
            Carton: oItem.Carton,
            Pallet: oItem.Pallet,
          });
        }

        return {
          ZreqNo:
            _aTableItems[0].Guid === "00000000-0000-0000-0000-000000000000"
              ? _guid
              : _aTableItems[0].Guid,
          toPallet: aToPallet,
        };
      },

      _saveChanges: () =>
        new Promise((reslove, reject) => {
          // frame the payload
          const oData = _oThis._buildPayload();
          const oModel = _oView.getModel();

          const success = (oDataResponse) => {
            try {
              // clear table selection
              _oTable.clearSelection();

              // cancel the changes by resetting the model
              oModel.resetChanges();

              // refresh model data
              oModel.refresh();

              // if no errors, resolve the promise
              reslove(oDataResponse);
            } catch (error) {
              // error in odata request
              reject("Failed to save the changes");
            }
          };

          const error = (oErrorResponse) => {
            reject(oErrorResponse);
          };

          _oView.getModel().create("/RequestSet", oData, {
            success,
            error,
          });
        }),

      saveCopyDelete: (bCopy) => {
        // get payload
        // frame the payload
        const oData = _oThis._buildPayload();
        const oModel = _oView.getModel();

        const success = (_) => {
          try {
            // clear table selection
            _oTable.clearSelection();

            // cancel the changes by resetting the model
            oModel.resetChanges();

            // refresh model data
            oModel.refresh();

            // toggle edit property in view model
            // _oViewModel.setProperty("/edit", false);

            // if no errors, resolve the promise
            // MessageToast.show("Saved Successfully !");
          } catch (error) {
            // error in odata request
            MessageToast.show("Failed to save the changes");
          }
        };

        const error = (_) => {
          //   console.log(bCopy);
          //   if (bCopy) {
          //     const iSelectedRowIndex = _aTableItems.findIndex(
          //       (obj) => obj.__metadata === _oRowSelected.__metadata
          //     );
          //   } else {
          //   }
        };

        _oView.getModel().create("/RequestSet", oData, {
          success,
          error,
        });
      },

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

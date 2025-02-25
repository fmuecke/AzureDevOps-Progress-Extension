import Q = require("q");

import TFS_Wit_Contracts = require("TFS/WorkItemTracking/Contracts");
import TFS_Wit_Client = require("TFS/WorkItemTracking/RestClient");
import TFS_Wit_Services = require("TFS/WorkItemTracking/Services");

import { StoredFieldReferences } from "./progressModels";
 
function GetStoredFields(): IPromise<any> {
    var deferred = Q.defer();
    VSS.getService<IExtensionDataService>(VSS.ServiceIds.ExtensionData).then((dataService: IExtensionDataService) => {
        dataService.getValue<StoredFieldReferences>("storedFields").then((storedFields:StoredFieldReferences) => {
            if (storedFields) {
                console.log("Retrieved fields from storage");
                deferred.resolve(storedFields);
            }
            else {
                deferred.reject("Failed to retrieve fields from storage");
            }
        });
    });
    return deferred.promise;
}

function getWorkItemFormService()
{
    return TFS_Wit_Services.WorkItemFormService.getService();
}

function updateProgressOnForm(storedFields:StoredFieldReferences) {
}

function updateProgressOnGrid(workItemId, storedFields:StoredFieldReferences):IPromise<any> {
    let progressFields = [storedFields.progressField];

    var deferred = Q.defer();

    var client = TFS_Wit_Client.getClient();
    client.getWorkItem(workItemId, progressFields).then((workItem: TFS_Wit_Contracts.WorkItem) => {
        if (storedFields.progressField !== undefined) {     

            var progress = 0;
            //if (effort > 0) {
            //    progress = 7;//(businessValue + timeCriticality + rroevalue)/effort;
            //}

            var document = [{
                from: null,
                op: "add",
                path: '/fields/' + storedFields.progressField,
                value: progress
            }];

            // Only update the work item if the progress has changed
            if (progress != workItem.fields[storedFields.progressField]) {
                client.updateWorkItem(document, workItemId).then((updatedWorkItem:TFS_Wit_Contracts.WorkItem) => {
                    deferred.resolve(updatedWorkItem);
                });
            }
            else {
                deferred.reject("No relevant change to work item");
            }
        }
        else
        {
            deferred.reject("Unable to calculate aggregated progress, please configure fields on the collection settings page.");
        }
    });

    return deferred.promise;
}

var formObserver = (context) => {
    return {
        onFieldChanged: function(args) {
            GetStoredFields().then((storedFields:StoredFieldReferences) => {
                if (storedFields && storedFields.progressField) {
                    //If one of fields in the calculation changes
                    /*if ((args.changedFields[storedFields.bvField] !== undefined) || 
                        (args.changedFields[storedFields.tcField] !== undefined) ||
                        (args.changedFields[storedFields.rvField] !== undefined) ||
                        (args.changedFields[storedFields.effortField] !== undefined)) {
                            updateProgressOnForm(storedFields);
                        }*/
                }
                else {
                    console.log("Unable to calculate aggregated progress, please configure fields on the collection settings page.");    
                }
            }, (reason) => {
                console.log(reason);
            });
        },
        
        onLoaded: function(args) {
            GetStoredFields().then((storedFields:StoredFieldReferences) => {
                if (storedFields && storedFields.progressField) {
                    updateProgressOnForm(storedFields);
                }
                else {
                    console.log("Unable to calculate aggregated progress, please configure fields on the collection settings page.");
                }
            }, (reason) => {
                console.log(reason);
            });
        }
    } 
}

var contextProvider = (context) => {
    return {
        execute: function(args) {
            GetStoredFields().then((storedFields:StoredFieldReferences) => {
                if (storedFields && storedFields.progressField) {
                    var workItemIds = args.workItemIds;
                    var promises = [];
                    $.each(workItemIds, function(index, workItemId) {
                        promises.push(updateProgressOnGrid(workItemId, storedFields));
                    });

                    // Refresh view
                    Q.all(promises).then(() => {
                        VSS.getService(VSS.ServiceIds.Navigation).then((navigationService: IHostNavigationService) => {
                            navigationService.reload();
                        });
                    });
                }
                else {
                    console.log("Unable to calculate aggregated progress, please configure fields on the collection settings page.");
                    //TODO: Disable context menu item
                }
            }, (reason) => {
                console.log(reason);
            });
        }
    };
}

let extensionContext = VSS.getExtensionContext();
VSS.register(`${extensionContext.publisherId}.${extensionContext.extensionId}.progress-work-item-form-observer`, formObserver);
VSS.register(`${extensionContext.publisherId}.${extensionContext.extensionId}.progress-contextMenu`, contextProvider);
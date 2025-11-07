/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

/************************************************************************************************ 
 *  
 * OTP-9736 : Restrict IF save
 * 
************************************************************************************************* 
 * 
 * Author: Jobin and Jismi IT Services 
 * 
 * Date Created : 28-October-2025 
 * 
 * Description : This User Event Script restricts the saving of an Item Fulfillment record
 *               if the associated Sales Order is in 'Pending Fulfillment' status and 
 *              the total Customer Deposit applied is less than the Sales Order total amount.
 *              The script runs on the 'beforeSubmit' event during the creation of an Item Fulfillment.
 * 
 * REVISION HISTORY
 *
 * @version 1.0 : 28-October-2025 :  The initial build was created by JJ0414
 * 
*************************************************************************************************/


define(['N/record', 'N/runtime', 'N/search', 'N/error'],




    (record, runtime, search, error) => {

        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         * 
         *  Checks if the Item Fulfillment is being created from a Sales Order with 'Pending Fulfillment' status.
         *  If so, it verifies if the total Customer Deposit applied is less than the Sales Order total.
         *  If the deposit is insufficient, it throws an error to block the save operation.
         */

 
        const beforeSubmit = (scriptContext) => {
                log.debug('Event Type', scriptContext.type);

            try {
                const execContext = runtime.executionContext;
 
                if (execContext !== runtime.ContextType.USER_INTERFACE) {
                    log.debug('Skipping', 'Not triggered from UI');
                    return;
                }
 
                if (scriptContext.type !== scriptContext.UserEventType.CREATE) {
                    log.debug('Skipping', 'Not a CREATE operation');
                    return;
                }
 
                const newRecord = scriptContext.newRecord;
                const salesOrderId = newRecord.getValue({ fieldId: 'createdfrom' });
 
                if (!salesOrderId) {
                    log.debug('Skipping', 'Item Fulfillment not created from Sales Order');
                    return;
                }
 
                const salesOrder = record.load({
                    type: record.Type.SALES_ORDER,
                    id: salesOrderId,
                    isDynamic: false
                });
 
                const soStatus = salesOrder.getText({ fieldId: 'status' });
                const soTotal = parseFloat(salesOrder.getValue({ fieldId: 'total' })) || 0;
 
                log.debug('Sales Order Details', 'Status: ' + soStatus + ', Total: ₹' + soTotal.toFixed(2));
 
                if (soStatus !== 'Pending Fulfillment') {
                    log.debug('Skipping', 'Sales Order is not in Pending Fulfillment');
                    return;
                }
 
                const depositTotal = getCustomerDepositTotal(salesOrderId);
 
                log.debug('Deposit Check', 'Deposit Total: ₹' + depositTotal.toFixed(2) + ', SO Total: ₹' + soTotal.toFixed(2));
 
                if (depositTotal < soTotal) {
                    const message = 'Deposit ₹' + depositTotal.toFixed(2) + ' is less than Sales Order total ₹' + soTotal.toFixed(2) + '. Fulfillment blocked.';
                   
                    throw error.create({
                        name: 'INSUFFICIENT_DEPOSIT',
                        message: message,
                        notifyOff: false
                    });
                }
 
                log.audit('Validation Passed', 'Sufficient deposit found. Fulfillment allowed.');
 
            } catch (e) {
                log.error('Error in beforeSubmit', e.toString());
                throw e;
            }
        };
 
        function getCustomerDepositTotal(salesOrderId) {
            try {
                const depositSearch = search.create({
                    type: search.Type.CUSTOMER_DEPOSIT,
                    filters: [
                        ['createdfrom', 'anyof', salesOrderId],
                        'AND',
                        ['mainline', 'is', 'T']
                    ],
                    columns: ['total']
                });
 
                let depositTotal = 0;
 
                depositSearch.run().each(function (result) {
                    const amount = parseFloat(result.getValue('total'));
                    if (!isNaN(amount)) {
                        depositTotal += amount;
                    }
                    return true;
                });
 
                return depositTotal;
 
            } catch (e) {
                log.error('Error in getCustomerDepositTotal', e.toString());
                return 0;
            }
        }
 
        return { beforeSubmit };
    });
 
 
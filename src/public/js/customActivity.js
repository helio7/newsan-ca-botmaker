define(['postmonger'], (Postmonger) => {
    'use strict';

    let $ = jQuery.noConflict(); // Evitar conflicto con otras versiones de jQuery
    let connection = new Postmonger.Session();

    let activity = {};

    // Configuration variables
    let eventDefinitionKey;

    $(window).ready(() => {
        // JB will respond the first time 'ready' is called with 'initActivity'
        connection.trigger('ready');
        connection.trigger('requestTokens');
        connection.trigger('requestEndpoints');
        connection.trigger("requestTriggerEventDefinition");
        connection.trigger("requestInteraction");
    });

    connection.on('initActivity', (data) => {
        if (data) activity = data;

        const inArguments = Boolean(
            data.arguments &&
            data.arguments.execute &&
            data.arguments.execute.inArguments &&
            data.arguments.execute.inArguments.length > 0
        ) ? data.arguments.execute.inArguments : [];

        console.log('inArguments when initActivity:', inArguments);

        const dataExtensionArg = inArguments.find(arg => arg.dataExtension);
        if (dataExtensionArg) document.getElementById('dataExtension').value = dataExtensionArg.dataExtension;

        const dataExtensionPhoneNumberColumnNameArg = inArguments.find(arg => arg.dataExtensionPhoneNumberColumnName);
        if (dataExtensionPhoneNumberColumnNameArg) document.getElementById('dataExtensionPhoneNumberColumnName').value = dataExtensionPhoneNumberColumnNameArg.dataExtensionPhoneNumberColumnName;

        const templateNameArg = inArguments.find(arg => arg.templateName);
        if (templateNameArg) document.getElementById('templateName').value = templateNameArg.templateName;

        const variablesArg = inArguments.find(arg => arg.variables);
        if (variablesArg) {
            const parsedVariables = deserializeString(variablesArg.variables);
            for (const parsedVariable in parsedVariables) {
                addItem(
                    parsedVariable,
                    parsedVariables[parsedVariable],
                );
            }
        }
    });

    connection.on('clickedNext', () => { // Save function within MC.
        const dataExtension = document.getElementById('dataExtension').value;
        const dataExtensionPhoneNumberColumnNameArg = document.getElementById('dataExtensionPhoneNumberColumnName').value;
        const templateName = document.getElementById('templateName').value;
        const phoneNumber = `{{Contact.Attribute."${dataExtension}".${dataExtensionPhoneNumberColumnNameArg}}}`;

        const groupDivs = document.querySelectorAll('.variable-item');
        const variablesObject = {};
        for (const groupDiv of groupDivs) {
            const inputs = groupDiv.querySelectorAll('input');
            let variableName = '';
            let dataExtensionColumnName = '';
            for (const input of inputs) {
                if (input.name === 'variableName') variableName = input.value;
                else if (input.name === 'dataExtensionColumnName') dataExtensionColumnName = input.value;
            }
            variablesObject[variableName] = `{{Contact.Attribute."${dataExtension}".${dataExtensionColumnName}}}`;
        }
        const variables = serializeObject(variablesObject);

        activity['arguments'].execute.inArguments = [
            { dataExtension: dataExtension ? dataExtension : null },
            { dataExtensionPhoneNumberColumnNameArg: dataExtensionPhoneNumberColumnNameArg ? dataExtensionPhoneNumberColumnNameArg : null },
            { templateName: templateName ? templateName : null },
            { phoneNumber: phoneNumber ? phoneNumber : null },
            { variables: variables ? variables : null },
        ];

        activity['metaData'].isConfigured = true;
        connection.trigger('updateActivity', activity);
    });

    /**
     * This function is to pull out the event definition within journey builder.
     * With the eventDefinitionKey, you are able to pull out values that passes through the journey
     */
    connection.on('requestedTriggerEventDefinition', (eventDefinitionModel) => {
        console.log("Requested TriggerEventDefinition", eventDefinitionModel.eventDefinitionKey);
        if (eventDefinitionModel) eventDefinitionKey = eventDefinitionModel.eventDefinitionKey;
    });

    connection.on('requestedTriggerEventDefinition', (eventDefinitionModel) => {
        if (eventDefinitionModel) eventDefinitionKey = eventDefinitionModel.eventDefinitionKey;
    });
});

function serializeObject(obj) {
    return Object.entries(obj)
        .map(([key, value]) => `${key}=${value}`)
        .join(';');
}

function deserializeString(str) {
    const result = {};
    str.split(';').forEach(pair => {
      const [key, ...rest] = pair.split('=');
      result[key] = rest.join('='); // Handles '=' inside the value
    });
    return result;
}

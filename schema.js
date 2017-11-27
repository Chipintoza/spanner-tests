'use strict';

const path = require('path');

// ------
const keyFilename = './spanner.json';
// ------

const spannerInstanceName = 'gss-data';
const spannerSystemDatabaseName = `test`;
const region = 'regional-us-central1';
const nodesCount = 1;


const spanner = require('@google-cloud/spanner')({
    projectId: 'spanner-gss-ge',
    keyFilename: keyFilename,

    instanceName: spannerInstanceName
});

let createSpannerInstance = (cb) => {
    spanner.instance(spannerInstanceName).exists((err, exists) => {

        if (!exists) {
            let config = {
                config: region,
                nodes: nodesCount
            };

            spanner.createInstance(spannerInstanceName, config, (err, instance, operation) => {
                if (err) {
                    return console.log(err);
                }

                operation
                    .on('error', function (err) {
                        console.log(err);
                    })
                    .on('complete', function () {
                        console.log('Instance created successfully.');
                        if (cb) cb();
                    });
            });
        }
        else {
            if (cb) cb();
        }
    });
};

let createSpannerSystemDatabase = (cb) => {
    let spannerInstance = spanner.instance(spannerInstanceName);

    spannerInstance.database(spannerSystemDatabaseName).exists((err, exists) => {
        if (!exists) {
            spannerInstance.createDatabase(spannerSystemDatabaseName, (err, database, operation) => {
                if (err) {
                    console.log(err);
                    return
                }

                operation
                    .on('error', function (err) {
                        console.log(err);
                    })
                    .on('complete', function () {
                        console.log('Database created successfully.');
                        if (cb) cb();
                    });
            });
        }
        else {
            if (cb) cb();
        }
    });
};

let createSpannerTables = () => {
    let spannerInstance = spanner.instance(spannerInstanceName);
    let database = spannerInstance.database(spannerSystemDatabaseName);

    const queryTableExist = (tableName) => {
        return {
            sql: `SELECT t.table_name FROM information_schema.tables AS t WHERE t.table_catalog = '' and t.table_schema = '' and  t.table_name='${tableName}'`
        };
    };
    let tableExist = (tableName, cb) => {
        const query = queryTableExist(tableName);
        database.run(query, (err, rows) => {
            if (err) {
                console.log(`${err}\n${query}`);
                return cb(err);
            }

            cb(err, rows.length > 0);
        })
    };

    const queryIndexeExist = (indexName) => {
        return {
            sql: `SELECT t.table_name FROM information_schema.indexes AS t WHERE t.table_catalog = '' and t.table_schema = '' and  t.index_name='${indexName}'`
        };
    };
    let indexExist = (indexName, cb) => {
        const query = queryIndexeExist(indexName);
        database.run(query, (err, rows) => {
            if (err) {
                console.log(`${err}\n${query}`);
                return cb(err);
            }

            cb(err, rows.length > 0);
        })
    };

    let administrativeActions = 0;

    let createTable = (tableName, schema, cb) => {
        tableExist(tableName, (err, exist) => {
            if (err) {
                if (cb) cb(err);
                return;
            }

            if (!exist) {
                if (administrativeActions === 5) {
                    return setTimeout(() => {
                        createTable(tableName, schema, cb);
                    }, 1000);
                }

                administrativeActions++;
                database.createTable(schema, (err, table, operation) => {
                    if (err) {
                        return console.log(`${err}\n${schema}`);
                    }

                    operation
                        .on('error', function (err) {
                            administrativeActions--;
                            console.log(`${err}\n${schema}`);

                            if (cb) cb(err);
                        })
                        .on('complete', function () {
                            administrativeActions--;
                            console.log(`${tableName} - Table created successfully.`);

                            if (cb) cb();
                        });
                });
            }
            else {
                if (cb) cb();
            }
        });
    };

    let updateIndex = (schemaName, statements, cb) => {
        indexExist(schemaName, (err, exist) => {
            if (err) {
                if (cb) cb(err);
                return;
            }

            if (!exist) {
                if (administrativeActions === 5) {
                    return setTimeout(() => {
                        updateIndex(schemaName, statements, cb);
                    }, 1000);
                }

                administrativeActions++;
                database.updateSchema(statements, function (err, operation) {
                    if (err) {
                        console.log(`${err}\n${statements}`);
                    }

                    operation
                        .on('error', function (err) {
                            administrativeActions--;
                            console.log(`${err}\n${statements}`);

                            if (cb) cb(err);
                        })
                        .on('complete', function () {
                            administrativeActions--;
                            console.log(`${schemaName} - Schema updated successfully.`);

                            if (cb) cb();
                        });
                });
            }
            else {
                if (cb) cb();
            }
        });
    };

    let userTableColumns =
        ' isActive BOOL,' +

        ' created INT64 NOT NULL,' +
        ' timestamp INT64 NOT NULL,' +
        ' modifierId STRING(36) NOT NULL,' +
        ' modifierName STRING(300) NOT NULL,' +

        ' eMail STRING(100) NOT NULL,' +
        ' contactName STRING(300) NOT NULL,' +
        ' mobile STRING(30) NOT NULL,' +

        ' webBrowserID STRING(36),' +

        ' photoID STRING(36),' +
        ' gssGroupID STRING(36) NOT NULL,' +

        ' timeZoneID STRING(100) NOT NULL,' +
        ' gssClientID STRING(36),' +

        ' purchasedServicesCasheExpiryDateString STRING(MAX),' +

        ' note STRING(MAX) NOT NULL,' +

        ' environmentsIds ARRAY<STRING(36)> NOT NULL,' +

        ' domainEnvironmentID STRING(36),' +
        ' checkDomainServices STRING(180) NOT NULL,' +

        ' googleName STRING(300) NOT NULL,' +
        ' googlePictureUrl STRING(2000) NOT NULL,' +
        ' googleProfile STRING(2000) NOT NULL,' +

        ' facebookName STRING(300) NOT NULL,' +
        ' facebookPictureUrl STRING(2000) NOT NULL,' +
        ' facebookProfile STRING(2000) NOT NULL,' +

        ' signedInBy STRING(20) NOT NULL,' +

        ' rsgeServiceUser STRING(100) NOT NULL,' +
        ' rsgeServiceUserPassword STRING(20) NOT NULL,' +

        ' envLanguage STRING(3) NOT NULL';

    let createUsersTable = (cb) => {
        createTable('Users', 'CREATE TABLE Users (' +
            ' userId STRING(36) NOT NULL,' +

            userTableColumns +

            ') PRIMARY KEY(userId)', cb);
    };
    let createUsersByEMailIndex = (cb) => {
        let schemaName = 'UsersByEMail';
        updateIndex(schemaName, `CREATE UNIQUE INDEX ${schemaName} ON Users (eMail)`, cb);
    };
    let createActiveUsersByGSSClientIDIndex = (cb) => {
        let schemaName = 'ActiveUsersByGSSClientID';
        updateIndex(schemaName, `CREATE UNIQUE NULL_FILTERED INDEX ${schemaName} ON Users (gssClientID, isActive)`, cb);
    };
    let createUsersByCreatedDescIsActiveIndex = (cb) => {
        let schemaName = 'UsersByCreatedDescIsActive';
        updateIndex(schemaName, `CREATE NULL_FILTERED INDEX ${schemaName} ON Users (created DESC, isActive)`, cb);
    };
    let createUsers_changesTable = (cb) => {
        createTable('Users_changes', 'CREATE TABLE Users_changes (' +
            ' userId STRING(36) NOT NULL,' +
            ' changeTimestamp INT64 NOT NULL,' +

            userTableColumns + ',' +

            ') PRIMARY KEY(userId, changeTimestamp),' +
            'INTERLEAVE IN PARENT Users ON DELETE CASCADE', cb);
    };
    let createUsers_wordsIndex = (cb) => {
        createTable('Users_wordsIndex', 'CREATE TABLE Users_wordsIndex (' +
            ' userId STRING(36) NOT NULL,' +
            ' word STRING(20) NOT NULL,' +
            ' columns ARRAY<STRING(20)> NOT NULL,' +

            ') PRIMARY KEY(userId, word),' +
            'INTERLEAVE IN PARENT Users ON DELETE CASCADE', cb);
    };

    let userSessionColumns =
        ' timestamp INT64 NOT NULL,' +

        ' hostName STRING(255) NOT NULL,' +
        ' webBrowserID STRING(36) NOT NULL,' +

        ' csrfSecret STRING(MAX) NOT NULL,' +
        ' expirationDate INT64 NOT NULL,' +

        ' info STRING(MAX)';
    let usersSessionsTable = (cb) => {
        createTable('UsersSessions', 'CREATE TABLE UsersSessions (' +
            ' userId STRING(36) NOT NULL,' +
            ' userSessionId STRING(36) NOT NULL,' +

            userSessionColumns + ',' +

            ') PRIMARY KEY(userId, userSessionId),' +
            'INTERLEAVE IN PARENT Users ON DELETE CASCADE', cb);
    };
    let createUsersSessionsByUserWebBrowserIDIndex = (cb) => {
        let schemaName = 'UsersSessionsByUserWebBrowserID';
        updateIndex(schemaName, `CREATE INDEX ${schemaName} ON UsersSessions (userId, webBrowserID, userSessionId), INTERLEAVE IN Users`, cb);
    };

    let usersSessions_changesTable = (cb) => {
        createTable('UsersSessions_changes', 'CREATE TABLE UsersSessions_changes (' +
            ' userId STRING(36) NOT NULL,' +
            ' userSessionId STRING(36) NOT NULL,' +
            ' changeTimestamp INT64 NOT NULL,' +

            userSessionColumns + ',' +

            ') PRIMARY KEY(userId, userSessionId, changeTimestamp),' +
            'INTERLEAVE IN PARENT Users ON DELETE CASCADE', cb);
    };

    let usersDataColumns =
        ' timestamp INT64 NOT NULL,' +

        ' data BYTES(MAX)';
    let usersDataTable = (cb) => {
        createTable('UsersData', 'CREATE TABLE UsersData (' +
            ' userId STRING(36) NOT NULL,' +
            ' userDataId STRING(36) NOT NULL,' +

            usersDataColumns + ',' +

            ') PRIMARY KEY(userId, userDataId ),' +
            'INTERLEAVE IN PARENT Users ON DELETE CASCADE', cb);
    };

    let usersSettingsColumns =
        ' timestamp INT64 NOT NULL,' +

        ' mainMenuVisible BOOL NOT NULL,' +
        ' environmentLanguage STRING(3) NOT NULL,' +

        ' defaultEnvironmentID STRING(36),' +

        ' codeDocumentFontSizeDifference INT64 NOT NULL,' +
        ' codeMenuColor INT64 NOT NULL,' +
        ' googleKeyboardOptions STRING(MAX) NOT NULL,' +
        ' gssCodeSearchStates STRING(MAX) NOT NULL';
    let usersSettingsTable = (cb) => {
        createTable('UsersSettings', 'CREATE TABLE UsersSettings (' +
            ' userId STRING(36) NOT NULL,' +
            ' userSettingId STRING(36) NOT NULL,' +

            usersSettingsColumns + ',' +

            ') PRIMARY KEY(userId, userSettingId ),' +
            'INTERLEAVE IN PARENT Users ON DELETE CASCADE', cb);
    };

    let organizationsColumns =
        ' isActive BOOL,' +

        ' timestamp INT64 NOT NULL,' +
        ' modifierId STRING(36) NOT NULL,' +
        ' modifierName STRING(300) NOT NULL,' +

        ' environmentId STRING(36) NOT NULL,' +

        ' code STRING(30) NOT NULL,' +
        ' name STRING(300) NOT NULL,' +

        ' registrationCountry STRING(300) NOT NULL,' +

        ' rsgeServiceUser STRING(100) NOT NULL,' +
        ' rsgeServiceUserPassword STRING(20) NOT NULL,' +

        ' rsgeUploadGoodsBy STRING(7) NOT NULL,' +
        ' rsgeImportIncomeGoodCodesBy STRING(7) NOT NULL,' +
        ' rsgeImportExpenditureGoodCodesBy STRING(7) NOT NULL,' +

        ' mainCurrencySignification INT64 NOT NULL,' +
        ' accountingCurrencySignifications ARRAY<INT64> NOT NULL,' +

        ' restoreExpirationDate INT64,' +

        ' usersIds ARRAY<STRING(36)> NOT NULL';
    let organizationsTable = (cb) => {
        createTable('Organizations', 'CREATE TABLE Organizations (' +
            ' shardId INT64 NOT NULL,' +
            ' organizationId INT64 NOT NULL,' +

            organizationsColumns + ',' +

            ') PRIMARY KEY(shardId, organizationId)', cb);
    };
    let organizations_changesTable = (cb) => {
        createTable('Organizations_changes', 'CREATE TABLE Organizations_changes (' +
            ' shardId INT64 NOT NULL,' +
            ' organizationId INT64 NOT NULL,' +
            ' changeTimestamp INT64 NOT NULL,' +

            organizationsColumns + ',' +

            ') PRIMARY KEY(shardId, organizationId, changeTimestamp),' +
            'INTERLEAVE IN PARENT Organizations ON DELETE CASCADE', cb);
    };

    // solutionId - retail-sale = 1, loyalty = 1
    let usersOrganizationsColumns =
        ' timestamp INT64 NOT NULL,' +
        ' solutionIds ARRAY<INT64> NOT NULL';
    let usersOrganizationsTable = (cb) => {
        createTable('UsersOrganizations', 'CREATE TABLE UsersOrganizations (' +
            ' userId STRING(36) NOT NULL,' +
            ' organizationId INT64 NOT NULL,' +

            usersOrganizationsColumns + ',' +

            ') PRIMARY KEY(userId, organizationId),' +
            'INTERLEAVE IN PARENT Users ON DELETE CASCADE', cb);
    };
    let usersOrganizations_changesTable = (cb) => {
        createTable('UsersOrganizations_changes', 'CREATE TABLE UsersOrganizations_changes (' +
            ' userId STRING(36) NOT NULL,' +
            ' organizationId INT64 NOT NULL,' +
            ' changeTimestamp INT64 NOT NULL,' +

            usersOrganizationsColumns + ',' +

            ') PRIMARY KEY(userId, organizationId, changeTimestamp),' +
            'INTERLEAVE IN PARENT Users ON DELETE CASCADE', cb);
    };

    let temporaryDataColumns =
        ' timestamp INT64 NOT NULL,' +

        ' key STRING(50),' +

        ' dataObject STRING(MAX),' +
        ' expirationDate INT64 NOT NULL';
    let temporaryDataTable = (cb) => {
        createTable('TemporaryData', 'CREATE TABLE TemporaryData (' +
            ' temporaryDataId STRING(36) NOT NULL,' +

            temporaryDataColumns + ',' +

            ') PRIMARY KEY(temporaryDataId)', cb);
    };
    let createTemporaryDataByKeyIndex = (cb) => {
        let schemaName = 'TemporaryDataByKey';
        updateIndex(schemaName, `CREATE INDEX ${schemaName} ON TemporaryData (key, temporaryDataId)`, cb);
    };
    let createTemporaryDataByExpirationDateIndex = (cb) => {
        let schemaName = 'TemporaryDataByExpirationDate';
        updateIndex(schemaName, `CREATE INDEX ${schemaName} ON TemporaryData (expirationDate, temporaryDataId)`, cb);
    };

    let environmentsColumns =
        ' isActive BOOL,' +

        ' created INT64 NOT NULL,' +
        ' timestamp INT64 NOT NULL,' +
        ' modifierId STRING(36) NOT NULL,' +
        ' modifierName STRING(300) NOT NULL,' +

        ' name STRING(300) NOT NULL,' +
        ' databaseID STRING(36) NOT NULL,' +

        ' isUnderControl BOOL NOT NULL,' +

        ' environmentSyncURL STRING(1024),' +

        ' linkedGSSContactID STRING(36),' +
        ' linkedContactID STRING(36),' +

        ' inputLanguages STRING(MAX) NOT NULL,' +
        ' usersInputLanguages STRING(MAX) NOT NULL,' +

        ' registrationCountry STRING(300) NOT NULL,' +
        ' rsgeServiceUser STRING(300) NOT NULL,' +
        ' rsgeServiceUserPassword STRING(300) NOT NULL,' +

        ' mainCurrencySignification INT64,' +

        ' accountingCurrencySignifications STRING(MAX) NOT NULL,' +

        ' domain STRING(50),' +
        ' gssEducationIsActive BOOL NOT NULL';
    let environmentsTable = (cb) => {
        createTable('Environments', 'CREATE TABLE Environments (' +
            ' environmentId STRING(36) NOT NULL,' +

            environmentsColumns + ',' +

            ') PRIMARY KEY(environmentId)', cb);
    };
    let createEnvironmentsByCreatedDescIsActiveIndex = (cb) => {
        let schemaName = 'EnvironmentsByCreatedDescIsActive';
        updateIndex(schemaName, `CREATE NULL_FILTERED INDEX ${schemaName} ON Environments (created DESC, isActive)`, cb);
    };
    let createEnvironmentsByDomainIndex = (cb) => {
        let schemaName = 'EnvironmentsByDomain';
        updateIndex(schemaName, `CREATE NULL_FILTERED INDEX ${schemaName} ON Environments (domain)`, cb);
    };
    let environments_changesTable = (cb) => {
        createTable('Environments_changes', 'CREATE TABLE Environments_changes (' +
            ' environmentId STRING(36) NOT NULL,' +
            ' changeTimestamp INT64 NOT NULL,' +

            environmentsColumns + ',' +

            ') PRIMARY KEY(environmentId, changeTimestamp),' +
            'INTERLEAVE IN PARENT Environments ON DELETE CASCADE', cb);
    };
    let environments_wordsIndex = (cb) => {
        createTable('Environments_wordsIndex', 'CREATE TABLE Environments_wordsIndex (' +
            ' environmentId STRING(36) NOT NULL,' +
            ' word STRING(20) NOT NULL,' +
            ' columns ARRAY<STRING(20)> NOT NULL,' +

            ') PRIMARY KEY(environmentId, word),' +
            'INTERLEAVE IN PARENT Environments ON DELETE CASCADE', cb);
    };

    let environmentsUsersColumns =
        ' timestamp INT64 NOT NULL';
    let environmentsUsersTable = (cb) => {
        createTable('EnvironmentsUsers', 'CREATE TABLE EnvironmentsUsers (' +
            ' environmentId STRING(36) NOT NULL,' +
            ' userId STRING(36) NOT NULL,' +

            environmentsUsersColumns + ',' +

            ') PRIMARY KEY(environmentId, userId),' +
            'INTERLEAVE IN PARENT Environments ON DELETE CASCADE', cb);
    };
    let environmentsUsers_changesTable = (cb) => {
        createTable('EnvironmentsUsers_changes', 'CREATE TABLE EnvironmentsUsers_changes (' +
            ' environmentId STRING(36) NOT NULL,' +
            ' userId STRING(36) NOT NULL,' +
            ' changeTimestamp INT64 NOT NULL,' +

            environmentsUsersColumns + ',' +

            ') PRIMARY KEY(environmentId, userId, changeTimestamp),' +
            'INTERLEAVE IN PARENT Environments ON DELETE CASCADE', cb);
    };
    let createEnvironmentsUsersByUserIdIndex = (cb) => {
        let schemaName = 'EnvironmentsUsersByUserId';
        updateIndex(schemaName, `CREATE INDEX ${schemaName} ON EnvironmentsUsers (userId)`, cb);
    };

    let databasesColumns =
        ' name STRING(300) NOT NULL,' +
        ' allowAddEnvironment BOOL NOT NULL';
    let databasesTable = (cb) => {
        createTable('Databases', 'CREATE TABLE Databases (' +
            ' databaseId STRING(36) NOT NULL,' +

            databasesColumns + ',' +

            ') PRIMARY KEY(databaseId)', cb);
    };

    let databasesLocationsColumns =
        ' baseAddresses STRING(MAX) NOT NULL,' +

        ' gssCodeDbConnectionString STRING(MAX) NOT NULL,' +
        ' myGSSDbConnectionString STRING(MAX) NOT NULL,' +
        ' mainDomain STRING(50) NOT NULL';
    let databasesLocationsTable = (cb) => {
        createTable('DatabaseLocations', 'CREATE TABLE DatabaseLocations (' +
            ' databaseId STRING(36) NOT NULL,' +
            ' databaseLocationId STRING(36) NOT NULL,' +

            databasesLocationsColumns + ',' +

            ') PRIMARY KEY(databaseId, databaseLocationId ),' +
            'INTERLEAVE IN PARENT Databases ON DELETE CASCADE', cb);
    };

    let LinkedProgramsColumns =
        ' created INT64 NOT NULL,' +
        ' programName STRING(50) NOT NULL,' +
        ' goodsSyncLassSessionId STRING(36) NOT NULL,' +
        ' goodsSyncBeforeLastSessionId STRING(36) NOT NULL,' +
        ' authorized BOOL NOT NULL';
    let LinkedProgramsTable = (cb) => {
        createTable('LinkedPrograms', 'CREATE TABLE LinkedPrograms (' +
            ' shardId INT64 NOT NULL,' +
            ' organizationId INT64 NOT NULL,' +
            ' linkedProgramId STRING(36) NOT NULL,' +

            LinkedProgramsColumns + ',' +

            ') PRIMARY KEY(shardId, organizationId, linkedProgramId),' +
            'INTERLEAVE IN PARENT Organizations ON DELETE CASCADE', cb);
    };

    let GoodsColumns =
        ' isActive BOOL,' +
        ' timestamp INT64 NOT NULL,' +
        ' grp STRING(MAX) NOT NULL,' +
        ' code STRING(60) NOT NULL,' +
        ' name STRING(255) NOT NULL,' +
        ' barCode STRING(30) NOT NULL,' +
        ' unit STRING(60) NOT NULL,' +
        ' isInSuperFin BOOL NOT NULL,' +
        ' archive BOOL NOT NULL';
    let goodsTable = (cb) => {
        createTable('Goods', 'CREATE TABLE Goods (' +
            ' organizationId INT64 NOT NULL,' +
            ' shardId INT64 NOT NULL,' +
            ' goodId INT64 NOT NULL,' +

            GoodsColumns + ',' +

            ') PRIMARY KEY(organizationId, shardId, goodId)', cb);
    };
    let goods_changesTable = (cb) => {
        createTable('Goods_changes', 'CREATE TABLE Goods_changes (' +
            ' organizationId INT64 NOT NULL,' +
            ' shardId INT64 NOT NULL,' +
            ' goodId INT64 NOT NULL,' +
            ' changeTimestamp INT64 NOT NULL,' +

            GoodsColumns + ',' +

            ') PRIMARY KEY(organizationId, shardId, goodId, changeTimestamp),' +
            'INTERLEAVE IN PARENT Goods ON DELETE CASCADE', cb);
    };
    let createGoodsByCodeNameIndex = (cb) => {
        let schemaName = 'GoodsByOrganizationIdCodeName';
        updateIndex(schemaName, `CREATE INDEX ${schemaName} ON Goods (organizationId, code, name)`, cb);
    };

    let GoodsTurnOversColumns =
        ' timestamp INT64 NOT NULL,' +
        ' debitAmount INT64 NOT NULL,' +
        ' creditAmount INT64 NOT NULL';
    let goodsTurnOversTable = (cb) => {
        createTable('GoodsTurnOvers', 'CREATE TABLE GoodsTurnOvers (' +
            ' organizationId INT64 NOT NULL,' +
            ' shardId INT64 NOT NULL,' +
            ' goodId INT64 NOT NULL,' +

            ' year INT64 NOT NULL,' +
            ' month INT64 NOT NULL,' +
            ' day INT64 NOT NULL,' +

            ' transactionType INT64 NOT NULL,' +

            GoodsTurnOversColumns + ',' +

            ') PRIMARY KEY(organizationId, shardId, goodId, year, month, day, transactionType),' +
            'INTERLEAVE IN PARENT Goods ON DELETE CASCADE', cb);
    };

    let GoodsStocksTurnOversColumns =
        ' timestamp INT64 NOT NULL,' +
        ' debitAmount INT64 NOT NULL,' +
        ' creditAmount INT64 NOT NULL';
    let goodsStocksTurnOversTable = (cb) => {
        createTable('GoodsStocksTurnOvers', 'CREATE TABLE GoodsStocksTurnOvers (' +
            ' organizationId INT64 NOT NULL,' +
            ' shardId INT64 NOT NULL,' +
            ' goodId INT64 NOT NULL,' +

            ' year INT64 NOT NULL,' +
            ' month INT64 NOT NULL,' +
            ' day INT64 NOT NULL,' +

            ' stockId INT64 NOT NULL,' +

            ' transactionType INT64 NOT NULL,' +

            GoodsStocksTurnOversColumns + ',' +

            ') PRIMARY KEY(organizationId, shardId, goodId, year, month, day, stockId, transactionType),' +
            'INTERLEAVE IN PARENT Goods ON DELETE CASCADE', cb);
    };

    let StocksColumns =
        ' isActive BOOL,' +
        ' timestamp INT64 NOT NULL,' +
        ' name STRING(300) NOT NULL,' +
        ' address STRING(MAX),' +
        ' note STRING(MAX) NOT NULL,' +
        ' archive BOOL NOT NULL';
    let stocksTable = (cb) => {
        createTable('Stocks', 'CREATE TABLE Stocks (' +
            ' organizationId INT64 NOT NULL,' +
            ' shardId INT64 NOT NULL,' +
            ' stockId INT64 NOT NULL,' +

            StocksColumns + ',' +

            ') PRIMARY KEY(organizationId, shardId, stockId)', cb);
    };
    let stocks_changesTable = (cb) => {
        createTable('Stocks_changes', 'CREATE TABLE Stocks_changes (' +
            ' organizationId INT64 NOT NULL,' +
            ' shardId INT64 NOT NULL,' +
            ' stockId INT64 NOT NULL,' +
            ' changeTimestamp INT64 NOT NULL,' +

            StocksColumns + ',' +

            ') PRIMARY KEY(organizationId, shardId, stockId, changeTimestamp),' +
            'INTERLEAVE IN PARENT Stocks ON DELETE CASCADE', cb);
    };

    let CashBoxesColumns =
        ' isActive BOOL,' +
        ' timestamp INT64 NOT NULL,' +
        ' name STRING(300) NOT NULL,' +
        ' cashRegisterId STRING(20) NOT NULL,' +
        ' stockId INT64,' +

        ' userIds ARRAY<STRING(36)> NOT NULL,' +
        ' bankTerminals ARRAY<STRING(MAX)> NOT NULL,' +

        ' note STRING(MAX) NOT NULL,' +

        ' archive BOOL NOT NULL';
    let cashBoxesTable = (cb) => {
        createTable('CashBoxes', 'CREATE TABLE CashBoxes (' +
            ' organizationId INT64 NOT NULL,' +
            ' shardId INT64 NOT NULL,' +
            ' cashBoxId INT64 NOT NULL,' +

            CashBoxesColumns + ',' +

            ') PRIMARY KEY(organizationId, shardId, cashBoxId)', cb);
    };
    let cashBoxes_changesTable = (cb) => {
        createTable('CashBoxes_changes', 'CREATE TABLE CashBoxes_changes (' +
            ' organizationId INT64 NOT NULL,' +
            ' shardId INT64 NOT NULL,' +
            ' cashBoxId INT64 NOT NULL,' +
            ' changeTimestamp INT64 NOT NULL,' +

            CashBoxesColumns + ',' +

            ') PRIMARY KEY(organizationId, shardId, cashBoxId, changeTimestamp),' +
            'INTERLEAVE IN PARENT CashBoxes ON DELETE CASCADE', cb);
    };

    let goodsDocumentsColumns =
        ' isActive BOOL,' +
        ' timestamp INT64 NOT NULL,' +
        ' date INT64 NOT NULL,' +
        ' number STRING(30) NOT NULL,' +
        ' transactionType INT64 NOT NULL,' +
        ' subject STRING(255) NOT NULL,' +
        ' stockId INT64 NOT NULL,' +
        ' receivedStockId INT64,' +

        ' accomplished BOOL NOT NULL';
    let goodsDocumentsTable = (cb) => {
        createTable('GoodsDocuments', 'CREATE TABLE GoodsDocuments (' +
            ' organizationId INT64 NOT NULL,' +
            ' shardId INT64 NOT NULL,' +
            ' documentId INT64 NOT NULL,' +

            goodsDocumentsColumns + ',' +

            ') PRIMARY KEY(organizationId, shardId, documentId)', cb);
    };
    let goodsDocuments_changesTable = (cb) => {
        createTable('GoodsDocuments_changes', 'CREATE TABLE GoodsDocuments_changes (' +
            ' organizationId INT64 NOT NULL,' +
            ' shardId INT64 NOT NULL,' +
            ' documentId INT64 NOT NULL,' +
            ' changeTimestamp INT64 NOT NULL,' +

            goodsDocumentsColumns + ',' +

            ') PRIMARY KEY(organizationId, shardId, documentId, changeTimestamp),' +
            'INTERLEAVE IN PARENT GoodsDocuments ON DELETE CASCADE', cb);
    };

    let goodsTransactionsColumns =
        ' documentTimestamp INT64 NOT NULL,' +
        ' date INT64 NOT NULL,' +
        ' goodId INT64 NOT NULL,' +
        ' transactionType INT64 NOT NULL,' +
        ' stockId INT64 NOT NULL,' +
        ' receivedStockId INT64,' +
        ' amount INT64 NOT NULL,' +
        ' accomplished BOOL NOT NULL';
    let goodsTransactionsTable = (cb) => {
        createTable('GoodsTransactions', 'CREATE TABLE GoodsTransactions (' +
            ' organizationId INT64 NOT NULL,' +
            ' shardId INT64 NOT NULL,' +
            ' documentId INT64 NOT NULL,' +
            ' transactionId INT64 NOT NULL,' +

            goodsTransactionsColumns + ',' +

            ') PRIMARY KEY(organizationId, shardId, documentId, transactionId),' +
            'INTERLEAVE IN PARENT GoodsDocuments ON DELETE CASCADE', cb);
    };
    let goodsTransactions_changesTable = (cb) => {
        createTable('GoodsTransactions_changes', 'CREATE TABLE GoodsTransactions_changes (' +
            ' organizationId INT64 NOT NULL,' +
            ' shardId INT64 NOT NULL,' +
            ' documentId INT64 NOT NULL,' +
            ' transactionId INT64 NOT NULL,' +
            ' changeTimestamp INT64 NOT NULL,' +

            goodsTransactionsColumns + ',' +

            ') PRIMARY KEY(organizationId, shardId, documentId, transactionId, changeTimestamp),' +
            'INTERLEAVE IN PARENT GoodsDocuments ON DELETE CASCADE', cb);
    };

    let goodsNegativeRemainsColumns =
        ' timestamp INT64 NOT NULL,' +
        ' documentDate INT64 NOT NULL,' +
        ' dateOfNegativeRemain INT64,' +
        ' state INT64 ,' +
        ' stateInfo STRING(MAX)';
    let goodsNegativeRemainsTable = (cb) => {
        createTable('GoodsNegativeRemains', 'CREATE TABLE GoodsNegativeRemains (' +
            ' organizationId INT64 NOT NULL,' +
            ' shardId INT64 NOT NULL,' +
            ' goodId INT64 NOT NULL,' +
            ' stockId INT64 NOT NULL,' +
            ' documentId INT64 NOT NULL,' +

            goodsNegativeRemainsColumns + ',' +

            ') PRIMARY KEY(organizationId, shardId, goodId, stockId, documentId),' +
            'INTERLEAVE IN PARENT Goods ON DELETE CASCADE', cb);
    };

    createUsersTable((err) => {
        if (err) return;

        usersSessionsTable((err) => {
                if (err) return;

                createUsersSessionsByUserWebBrowserIDIndex();
            }
        );
        usersDataTable();
        usersSettingsTable();
        usersSessions_changesTable();

        createUsers_changesTable();
        createUsers_wordsIndex();

        createUsersByEMailIndex();
        createActiveUsersByGSSClientIDIndex();
        createUsersByCreatedDescIsActiveIndex();

        usersOrganizationsTable();
        usersOrganizations_changesTable();
    });

    temporaryDataTable((err) => {
        if (err) return;

        createTemporaryDataByKeyIndex();
        createTemporaryDataByExpirationDateIndex();
    });

    environmentsTable((err) => {
        if (err) return;

        environments_changesTable();
        environments_wordsIndex();

        createEnvironmentsByCreatedDescIsActiveIndex();
        createEnvironmentsByDomainIndex();

        environmentsUsersTable((err) => {
            if (err) return;

            createEnvironmentsUsersByUserIdIndex();
        });
        environmentsUsers_changesTable();
    });

    organizationsTable((err) => {
        if (err) return;

        organizations_changesTable();
        LinkedProgramsTable();
    });

    goodsTable((err) => {
        if (err) return;

        createGoodsByCodeNameIndex();

        goods_changesTable();

        goodsTurnOversTable();
        goodsStocksTurnOversTable();

        goodsNegativeRemainsTable();
    });

    stocksTable((err) => {
        if (err) return;

        stocks_changesTable();
    });

    cashBoxesTable((err) => {
        if (err) return;

        cashBoxes_changesTable();
    });

    goodsDocumentsTable((err) => {
        if (err) return;

        goodsDocuments_changesTable();

        goodsTransactionsTable();
        goodsTransactions_changesTable();
    });

    databasesTable((err) => {
        if (err) return;

        databasesLocationsTable();
    });
};

createSpannerInstance(() => createSpannerSystemDatabase(() => createSpannerTables()));


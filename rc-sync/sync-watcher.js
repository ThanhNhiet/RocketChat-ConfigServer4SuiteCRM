const { MongoClient } = require('mongodb');

// ==========================================
// CẤU HÌNH KẾT NỐI (SỬA TẠI ĐÂY)
// ==========================================
const CONFIG = {
    // Choose type connection: 'METEOR_DEV' | 'LOCAL_DB' | 'ATLAS'
    type: 'METEOR_DEV', 

    // Meteor Dev (default port 3001, no password)
    meteor: {
        host: '127.0.0.1',
        port: 3001,
        dbName: 'meteor'
    },

    // Configuration for Local Database (Docker or installed locally, usually with user/pass)
    local: {
        host: '127.0.0.1',
        port: 27017,
        dbName: 'rocketchat',
        username: 'admin',     // Leave empty '' if none
        password: 'password',  // Leave empty '' if none
        authSource: 'admin'    // Database storing user (usually admin)
    },

    // Configuration for MongoDB Atlas (Cloud)
    atlas: {
        uri: 'mongodb+srv://admin:<db_password>@xxxxx.xxxxxx.mongodb.net/?appName=xxxxx',
        dbName: 'rocketchat',
    }
};

function getConnectionDetails() {
    let uri = '';
    let dbName = '';

    const { type } = CONFIG;

    if (type === 'METEOR_DEV') {
        const conf = CONFIG.meteor;
        uri = `mongodb://${conf.host}:${conf.port}/${conf.dbName}`;
        dbName = conf.dbName;
    } 
    else if (type === 'LOCAL_DB') {
        const conf = CONFIG.local;
        if (conf.username && conf.password) {
            const user = encodeURIComponent(conf.username);
            const pass = encodeURIComponent(conf.password);
            uri = `mongodb://${user}:${pass}@${conf.host}:${conf.port}?authSource=${conf.authSource}`;
        } else {
            uri = `mongodb://${conf.host}:${conf.port}/`;
        }
        dbName = conf.dbName;
    } 
    else if (type === 'ATLAS') {
        const conf = CONFIG.atlas;
        uri = conf.uri;
        dbName = conf.dbName;
    }

    return { uri, dbName };
}


async function main() {
    const { uri, dbName } = getConnectionDetails();
    
    console.log(`Connecting to: [${CONFIG.type}]`);
    console.log(`Target DB: ${dbName}`);

    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log("Connected to MongoDB successfully!");

        const db = client.db(dbName);
        const collection = db.collection("users");

        console.log("Listening for changes...");

        const changeStream = collection.watch([
            {
                $match: {
                    $or: [
                        { operationType: "insert" },
                        { operationType: "update" },
                        { operationType: "replace" }
                    ]
                }
            }
        ]);

        changeStream.on("change", async (change) => {
            if (change.operationType === 'update' && change.updateDescription && change.updateDescription.updatedFields) {
                const updatedKeys = Object.keys(change.updateDescription.updatedFields);
                const isSelfUpdate = updatedKeys.every(key => key.startsWith('customFields'));
                if (isSelfUpdate) return;
            }

            const userId = change.documentKey._id;
            
            // Find user
            const user = await collection.findOne({ _id: userId });

            if (user && user.services && user.services.suitecrm) {
                const suiteData = user.services.suitecrm;
                const currentCustom = user.customFields || {};

                // Compare data
                if (currentCustom.suitecrm_token === suiteData.accessToken) {
                    return; 
                }

                // Update
                await collection.updateOne(
                    { _id: userId },
                    {
                        $set: {
                            "customFields.suitecrm_id": suiteData.id,
                            "customFields.suitecrm_token": suiteData.accessToken,
                            "customFields.suitecrm_refresh": suiteData.refreshToken,
                            "customFields.suitecrm_expires_at": suiteData.expiresAt
                        }
                    }
                );
                
                console.log(`[SYNC SUCCESS] Copied token for user: ${user.username || userId}`);
            }
        });

        // Keep the process running
        await new Promise(() => {});

    } catch (e) {
        console.error("Connection error:", e.message);
        if (CONFIG.type === 'ATLAS') {
            console.log("Atlas tip: Check IP Whitelist in Network Access on MongoDB Atlas.");
        }
    } finally {
        await client.close();
    }
}

main().catch(console.error);
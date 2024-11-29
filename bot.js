const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// Replace the value below with the Telegram token you receive from @BotFather
const token = process.env.TOKEN;

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

const express = require("express")
const app = express();
var listener = app.listen(process.env.PORT || 2000, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
app.listen(() => console.log("I'm Ready To Work..! 24H"));
app.get('/', (req, res) => {
  res.send(`
  <body>
  <center><h1>Bot 24H ON!</h1></center
  </body>`)
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

const sqlite3 = require('sqlite3').verbose();

const db = [];

bot.onText(/\/schedule/, (msg) => {
    const chatId = msg.chat.id;

    // Check if a database for this user already exists
    if (!db[chatId]) {
        // If not, create a new database for this user
        db[chatId] = new sqlite3.Database(`botdata_${chatId}.db`);
    }
    // Retrieve the main and lab schedule links from the database based on chat ID
    db[chatId].all("SELECT * FROM links", (err, rows) => {
        if (err) {
            console.error(err.message);
            bot.sendMessage(chatId, 'Failed to fetch schedule links.');
            return;
        }

        const mainScheduleLink = rows.find(row => row.type === 'main');
        const labScheduleLink = rows.find(row => row.type === 'lab');

        if (!mainScheduleLink || !labScheduleLink) {
            bot.sendMessage(chatId, 'Schedule links not found.');
            return;
        }

        // Create a keyboard with two buttons: "Lab Schedule" and "Main Schedule"
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Lab Schedule', url: labScheduleLink.link },
                        { text: 'Main Schedule', url: mainScheduleLink.link }
                    ]
                ]
            }
        };

        // Send a message with the keyboard
        bot.sendMessage(chatId, 'Choose a schedule:', keyboard);
    });
});

////////////////////////////////////////////////////////////////////////////////////


bot.onText(/\/changeschedulelinks/, (msg) => {
    const chatId = msg.chat.id;
  // Check if a database for this user already exists
    if (!db[chatId]) {
        // If not, create a new database for this user
        db[chatId] = new sqlite3.Database(`botdata_${chatId}.db`);
    }

  
    bot.sendMessage(chatId, 'Which schedule link do you want to change?', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Main Schedule', callback_data: '/changeschedulelink_main' }],
                [{ text: 'Lab Schedule', callback_data: '/changeschedulelink_lab' }]
            ]
        }
    });
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === '/changeschedulelink_main') {
        bot.sendMessage(chatId, 'Enter the new main schedule link:');
        bot.once('text', (msg) => {
            const newLink = msg.text.trim();
            // Update the main schedule link in the database based on chat ID
            db[chatId].run("UPDATE links SET link = ? WHERE type = 'main'", [newLink], (err) => {
                if (err) {
                    console.error(err.message);
                    bot.sendMessage(chatId, 'Failed to update main schedule link.');
                } else {
                    bot.sendMessage(chatId, 'Main schedule link changed successfully.');
                }
            });
        });
    } else if (data === '/changeschedulelink_lab') {
        bot.sendMessage(chatId, 'Enter the new lab schedule link:');
        bot.once('text', (msg) => {
            const newLink = msg.text.trim();
            // Update the lab schedule link in the database based on chat ID
            db[chatId].run("UPDATE links SET link = ? WHERE type = 'lab'", [newLink], (err) => {
                if (err) {
                    console.error(err.message);
                    bot.sendMessage(chatId, 'Failed to update lab schedule link.');
                } else {
                    bot.sendMessage(chatId, 'Lab schedule link changed successfully.');
                }
            });
        });
    }
});

/////////////////////////////////////////////////////////////////////////////

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Define the schedule (for the initial state)
const schedule = {
    'Sunday': 'you did not add anything on today\'s schedule, use /changedayschedule to add lecs or tut',
    'Monday': 'you did not add anything on today\'s schedule, use /changedayschedule to add lecs or tut',
    'Tuesday': 'you did not add anything on today\'s schedule, use /changedayschedule to add lecs or tut',
    'Wednesday': 'you did not add anything on today\'s schedule, use /changedayschedule to add lecs or tut',
    'Thursday': 'you did not add anything on today\'s schedule, use /changedayschedule to add lecs or tut',
    'Friday': 'weekend',
    'Saturday': 'weekend'
};

// Store database connections for each user
const mainscheduleDB = {};

// Initialize the database and create the 'schedule' table if it doesn't exist
function initializeDatabase(chatId) {
    if (!mainscheduleDB[chatId]) {
        mainscheduleDB[chatId] = new sqlite3.Database(`mainschedule_${chatId}.db`, (err) => {
            if (err) {
                console.error('Error connecting to database:', err.message);
            } else {
                console.log('Connected to the database for chat ID:', chatId);
            }
        });

        // Create the table if it doesn't exist
        mainscheduleDB[chatId].run(`
            CREATE TABLE IF NOT EXISTS schedule (
                day TEXT PRIMARY KEY,
                classes TEXT
            )
        `, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            } else {
                console.log('Table created or already exists for chat ID:', chatId);
            }
        });
    }
}

// Handle the /changedayschedule command
bot.onText(/\/changedayschedule/, (msg) => {
    const chatId = msg.chat.id;
    initializeDatabase(chatId); // Ensure the database is initialized

    bot.sendMessage(chatId, 'Choose a day to change the schedule:', {
        reply_markup: {
            inline_keyboard: daysOfWeek.map(day => [{ text: day, callback_data: `change_${day}` }])
        }
    });
});

// Handle callback queries for changing the schedule
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data.split('_');
    const action = data[0];
    const day = data[1];

    if (action === 'change') {
        // Fetch the current class for the selected day
        mainscheduleDB[chatId].get("SELECT classes FROM schedule WHERE day = ?", [day], (err, row) => {
            if (err) {
                console.error(err.message);
                bot.sendMessage(chatId, 'Failed to fetch current schedule.');
                return;
            }

            const currentClass = row ? row.classes : 'No class scheduled yet';

            // Send current schedule and prompt for new class
            bot.sendMessage(chatId, `Current schedule for ${day}:`)
                .then(() => setTimeout(() => {
                    bot.sendMessage(chatId, `${currentClass}`)
                        .then(() => setTimeout(() => {
                            bot.sendMessage(chatId, `Enter the new class for ${day}:`);
                        }, 10));
                }, 10));

            bot.once('text', (msg) => {
                const newClass = msg.text.trim();

                // Check if the day already exists in the table
                mainscheduleDB[chatId].get("SELECT classes FROM schedule WHERE day = ?", [day], (err, row) => {
                    if (err) {
                        console.error(err.message);
                        bot.sendMessage(chatId, 'Error fetching schedule from database.');
                        return;
                    }

                    if (row) {
                        // Update existing entry
                        mainscheduleDB[chatId].run("UPDATE schedule SET classes = ? WHERE day = ?", [newClass, day], (err) => {
                            if (err) {
                                console.error(err.message);
                                bot.sendMessage(chatId, 'Failed to update schedule.');
                            } else {
                                bot.sendMessage(chatId, `Schedule for ${day} changed to ${newClass}.`);
                            }
                        });
                    } else {
                        // Insert new entry
                        mainscheduleDB[chatId].run("INSERT INTO schedule (day, classes) VALUES (?, ?)", [day, newClass], (err) => {
                            if (err) {
                                console.error(err.message);
                                bot.sendMessage(chatId, 'Failed to insert new schedule.');
                            } else {
                                bot.sendMessage(chatId, `Schedule for ${day} set to ${newClass}.`);
                            }
                        });
                    }
                });
            });
        });
    }
});

// Function to fetch the next day's schedule
function getNextClass(chatId) {
    const egyptDate = moment.tz("Africa/Cairo");
    console.log("Current Cairo Date and Time: ", egyptDate.format()); // Log Cairo time and date
    let nextDayIndex = egyptDate.day() + 1; // Get the next day of the week
    if (nextDayIndex === 7) {
        nextDayIndex = 0; // Reset to Sunday if it's Saturday (since `getDay()` starts with Sunday as 0)
    }
    console.log("Next day index in Cairo timezone: ", nextDayIndex); // Log the next day's index for debugging

    let nextDay = daysOfWeek[nextDayIndex]; // Get the day name
    console.log("Next day name: ", nextDay); // Log the next day's name for debugging

    return new Promise((resolve, reject) => {
        mainscheduleDB[chatId].get("SELECT classes FROM schedule WHERE day = ?", [nextDay], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(`On ${nextDay}, the schedule is:\n${row ? row.classes : 'No classes scheduled.'}`);
            }
        });
    });
}

// Function to fetch today's schedule
function getTodayClass(chatId) {
    const egyptDate = moment.tz("Africa/Cairo");
    console.log("Current Cairo Date and Time: ", egyptDate.format()); // Log the Cairo time and date for debugging
    const today = egyptDate.day(); // Get the day of the week (0 = Sunday, 1 = Monday, etc.)
    console.log("Day of the week in Cairo timezone: ", today); // Log the day of the week for debugging

    let thisday = daysOfWeek[today]; // Map to actual day name using your daysOfWeek array

    return new Promise((resolve, reject) => {
        mainscheduleDB[chatId].get("SELECT classes FROM schedule WHERE day = ?", [thisday], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(`On ${thisday}, the schedule is:\n${row ? row.classes : 'No classes scheduled.'}`);
            }
        });
    });
}

// Handle the /tomorrowschedule command
bot.onText(/\/tomorrowschedule/, async (msg) => {
    const chatId = msg.chat.id;
    initializeDatabase(chatId);

    try {
        const tomorrowschedule = await getNextClass(chatId);
        bot.sendMessage(chatId, tomorrowschedule);
    } catch (err) {
        console.error(err.message);
        bot.sendMessage(chatId, 'Failed to fetch schedule. Try using /start.');
    }
});

// Handle the /todayschedule command
bot.onText(/\/todayschedule/, async (msg) => {
    const chatId = msg.chat.id;
    initializeDatabase(chatId);

    try {
        const todayschedule = await getTodayClass(chatId);
        bot.sendMessage(chatId, todayschedule);
    } catch (err) {
        console.error(err.message);
        bot.sendMessage(chatId, 'Failed to fetch schedule. Try using /start.');
    }
});
//////////////////////////////////////////////////////////////////////////////////

const cron = require('node-cron');
const moment = require('moment-timezone');

// Ensure you have a separate initialization for todolistDB
const todolistDB = {};  // Store database connections for the to-do list

// Initialize the user database and create the 'users' table if it doesn't exist
const userDB = new sqlite3.Database('users.db', (err) => {
    if (err) {
        console.error('Error connecting to users database:', err.message);
    } else {
        console.log('Connected to the users database.');
    }
});

// Create the 'users' table with an auto-adjust flag
userDB.run(
    `CREATE TABLE IF NOT EXISTS users (
        chatId TEXT PRIMARY KEY,
        autoAdjustEnabled INTEGER DEFAULT 0
    )`,
    (err) => {
        if (err) {
            console.error('Error creating users table:', err.message);
        } else {
            console.log('Users table created or already exists.');
        }
    }
);

// Initialize the to-do list database and create the 'todo' table if it doesn't exist
function initializeTodoListDatabase(chatId) {
    if (!todolistDB[chatId]) {
        todolistDB[chatId] = new sqlite3.Database(`todolist_${chatId}.db`, (err) => {
            if (err) {
                console.error('Error connecting to to-do list database:', err.message);
            } else {
                console.log('Connected to the to-do list database for chat ID:', chatId);
            }
        });

        // Create the table if it doesn't exist
        todolistDB[chatId].run(
            `CREATE TABLE IF NOT EXISTS todo (
                task TEXT
            )`,
            (err) => {
                if (err) {
                    console.error('Error creating todo table:', err.message);
                } else {
                    console.log('To-do table created or already exists for chat ID:', chatId);
                }
            }
        );
    }
}
// Handle the /todoenable command
bot.onText(/\/todoenable/, (msg) => {
    const chatId = msg.chat.id;
    initializeTodoListDatabase(chatId);  // Ensure the to-do database is initialized

    userDB.run(`INSERT OR IGNORE INTO users (chatId) VALUES (?)`, [chatId]);

    // Toggle the autoAdjustEnabled flag
    userDB.get(`SELECT autoAdjustEnabled FROM users WHERE chatId = ?`, [chatId], (err, row) => {
        if (err) {
            console.error('Error fetching flag:', err.message);
            bot.sendMessage(chatId, 'Error updating auto adjustment setting.');
            return;
        }

        const newFlag = row.autoAdjustEnabled === 0 ? 1 : 0; // Toggle the flag

        userDB.run(`UPDATE users SET autoAdjustEnabled = ? WHERE chatId = ?`, [newFlag, chatId], (err) => {
            if (err) {
                console.error('Error updating flag:', err.message);
                bot.sendMessage(chatId, 'Error updating auto adjustment setting.');
            } else {
                const statusMessage = newFlag === 1 
                    ? 'Auto-adjustment for your to-do list is now enabled.'
                    : 'Auto-adjustment for your to-do list is now disabled.';
                bot.sendMessage(chatId, statusMessage);
            }
        });
    });
});

// Handle the /addtasks command
bot.onText(/\/addtasks/, async (msg) => {
    const chatId = msg.chat.id;
    initializeTodoListDatabase(chatId);  // Initialize the todolistDB
    initializeDatabase(chatId);
    userDB.run(`INSERT OR IGNORE INTO users (chatId) VALUES (?)`, [chatId]);

    // Store chat ID in the users table if it doesn't already exist
    userDB.run(`INSERT OR IGNORE INTO users (chatId) VALUES (?)`, [chatId]);

    try {
        const todayschedule = await getTodayClass(chatId);  // Fetch today's schedule

        // Split the schedule into lines and filter out the unnecessary parts
        const tasks = todayschedule.split('\n').filter((line, index) => {
            return index !== 0;  // Skip the first line (e.g., "on Wednesday the schedule is:")
        }).map(line => {
            // Remove the period and task number (e.g., "3rd:", "1st:", etc.)
            let task = line.replace(/^\d+(st|nd|rd|th):/, '').trim(); 
            
            // Remove the arrow (--> and anything after it, e.g., "8310")
            task = task.split('-->')[0].trim(); 
            
            return task;  // Return the cleaned-up task
        });

        // Check for duplicates before adding tasks to the todolistDB
        const existingTasks = await new Promise((resolve, reject) => {
            todolistDB[chatId].all(`SELECT task FROM todo`, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(row => row.task));
            });
        });

        // Insert the cleaned tasks into todolistDB only if they don't already exist
        tasks.forEach(task => {
            if (task && !existingTasks.includes(task)) {  // Check if the task already exists
                todolistDB[chatId].run(`INSERT INTO todo (task) VALUES (?)`, [task], (err) => {
                    if (err) {
                        console.error('Failed to insert task into todolist:', err.message);
                    }
                });
            }
        });

        bot.sendMessage(chatId, 'Today\'s schedule has been added to your to-do list.');
    } catch (err) {
        console.error(err.message);
        bot.sendMessage(chatId, 'Failed to fetch today\'s schedule. Try using /start.');
    }
});

// Handle the /completetask command
bot.onText(/\/tododone/, (msg) => {
    const chatId = msg.chat.id;
    initializeTodoListDatabase(chatId);  // Ensure the to-do database is initialized
    userDB.run(`INSERT OR IGNORE INTO users (chatId) VALUES (?)`, [chatId]);
    // Fetch tasks from todolistDB
    todolistDB[chatId].all(`SELECT rowid AS id, task FROM todo`, [], (err, rows) => {
        if (err) {
            console.error('Failed to fetch tasks:', err.message);  // Log the error message
            bot.sendMessage(chatId, 'Error fetching to-do list.');
            return;
        }

        if (rows.length === 0) {
            bot.sendMessage(chatId, 'Your to-do list is empty!');
            return;
        }

        // List tasks for the user to choose which one is done
        const taskOptions = rows.map(row => [{ text: row.task, callback_data: `done_${row.id}` }]);

        bot.sendMessage(chatId, 'Which task is done?', {
            reply_markup: {
                inline_keyboard: taskOptions
            }
        });
    });
});

// Handle task completion
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data.split('_');
    const action = data[0];
    const taskId = data[1];

    if (action === 'done') {
        // Remove the completed task
        todolistDB[chatId].run(`DELETE FROM todo WHERE rowid = ?`, [taskId], (err) => {
            if (err) {
                console.error('Failed to remove task:', err.message);
                bot.sendMessage(chatId, 'Error removing task from the list.');
            } else {
                bot.sendMessage(chatId, 'Task removed from your to-do list.');
                bot.sendSticker(chatId, 'CAACAgIAAxkBAAITg2dAedItRbj0iVv8eW77ZIwG3RYuAALDPQACzBMpSoUPzZoaigNGNgQ');
            }
        });
    }
});

// /showtasks command handler
bot.onText(/\/todolist/, async (msg) => {
    const chatId = msg.chat.id;
    initializeTodoListDatabase(chatId);  // Ensure the to-do database is initialized
    userDB.run(`INSERT OR IGNORE INTO users (chatId) VALUES (?)`, [chatId]);
    // Query to get tasks from the todolistDB
    todolistDB[chatId].all("SELECT task FROM todo", [], (err, rows) => {
        if (err) {
            console.error('Error fetching tasks from to-do list:', err.message);
            bot.sendMessage(chatId, 'Error retrieving your to-do list. Please try again later.');
            return;
        }

        // Check if there are tasks in the to-do list
        if (rows.length === 0) {
            bot.sendMessage(chatId, 'Your to-do list is empty.');
            bot.sendSticker(chatId, 'CAACAgIAAxkBAAITgWdAeWnjb93sAyS2SStgZWs353WaAAIlLQACA09IS2zI-NshxZfINgQ');
            return;
        }

        // Create a formatted string of tasks
        let taskList = 'Your To-Do List:\n';
        rows.forEach((row, index) => {
            taskList += `${index + 1}. ${row.task}\n`;  // Add task number
        });

        // Send the formatted task list back to the user
        bot.sendMessage(chatId, taskList);
    });
});

// Schedule a job to run every minute, but we will check inside for 12:15 PM Cairo time
cron.schedule('0 * * * *', async () => {
    const cairoTime = moment.tz('Africa/Cairo');
    const currentHour = cairoTime.hour();
    const currentMinute = cairoTime.minute();

    console.log('Cron job triggered at Cairo time:', cairoTime.format());

    // Check if the time is 00:00 AM
    if (currentHour === 0) {
        console.log('It is 00:00 AM Cairo time, executing schedule logic');

        const dayOfWeek = cairoTime.day(); // 0: Sunday, 1: Monday, ..., 5: Friday, 6: Saturday

        // Skip Friday (5) and Saturday (6)
        if (dayOfWeek !== 5 && dayOfWeek !== 6) {
            // Fetch the schedule for all users
            userDB.all(`SELECT chatId, autoAdjustEnabled FROM users`, [], async (err, rows) => {
                if (err) {
                    console.error('Error fetching chat IDs:', err.message);
                    return;
                }

                for (const row of rows) {
                    const chatId = row.chatId;  // Get the chat ID
                    const autoAdjustEnabled = row.autoAdjustEnabled;

                    if (autoAdjustEnabled) {
                        await fetchAndAddSchedule(chatId);
                    }
                }
            });
        }
    }
});

// Function to fetch today's schedule and add it to the to-do list
async function fetchAndAddSchedule(chatId) {
    try {
        initializeTodoListDatabase(chatId);
        initializeDatabase(chatId);
        userDB.run(`INSERT OR IGNORE INTO users (chatId) VALUES (?)`, [chatId]);

        const todayschedule = await getTodayClass(chatId);  // Fetch today's schedule

        // Split the schedule into lines and filter out unnecessary parts
        const tasks = todayschedule.split('\n').filter((line, index) => {
            return index !== 0;  // Skip the first line
        }).map(line => {
            let task = line.replace(/^\d+(st|nd|rd|th):/, '').trim();
            task = task.split('-->')[0].trim();
            return task;
        });

        // Check for duplicates before adding tasks
        const existingTasks = await new Promise((resolve, reject) => {
            todolistDB[chatId].all(`SELECT task FROM todo`, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(row => row.task));
            });
        });

        // Insert the cleaned tasks into todolistDB only if they don't already exist
        tasks.forEach(task => {
            if (task && !existingTasks.includes(task)) {
                todolistDB[chatId].run(`INSERT INTO todo (task) VALUES (?)`, [task], (err) => {
                    if (err) {
                        console.error('Failed to insert task into todolist:', err.message);
                    }
                });
            }
        });

        console.log(`Today's schedule added to ${chatId}'s to-do list.`);
    } catch (err) {
        console.error('Failed to fetch and add schedule:', err.message);
    }
}

////////////////////////////////////////////////////////////////////////////////////////
// Define the lab schedule including the date and comments for each lab
const labSchedule = [
    { date: '2024-03-25', name: 'Lab 1', comment: 'no lab' },
    { date: '2024-05-20', name: 'Lab 2', comment: 'no lab' },
    { date: '2024-03-24', name: 'Lab 3', comment: 'no lab' },
    { date: '2024-03-31', name: 'Lab 4', comment: 'no lab' },
    { date: '2024-04-07', name: 'Lab 5', comment: 'no lab' }
];

// Connect to the SQLite database
const labScheduleDB = {};

// /nextlab command to fetch the next upcoming lab
bot.onText(/\/nextlab/, async (msg) => {
    const chatId = msg.chat.id;
    const today = new Date().toISOString().split('T')[0];

    if (!labScheduleDB[chatId]) {
        labScheduleDB[chatId] = new sqlite3.Database(`labschedule_${chatId}.db`);
    }

    try {
        const rows = await new Promise((resolve, reject) => {
            labScheduleDB[chatId].all(`SELECT * FROM labschedule WHERE date >= ? AND comment != 'no lab' ORDER BY date`, [today], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });

        const upcomingLabs = rows.filter(row => new Date(row.date) > new Date(today));

        if (upcomingLabs.length === 0) {
            bot.sendMessage(chatId, 'There are no upcoming labs.');
            bot.sendSticker(chatId, 'CAACAgIAAxkBAAITimdAerd0BjKd-OSqCQABs9nLPj_TEgACAzYAAgjOMErEAAH7H5AfVxw2BA');
            return;
        }

        const nextLab = upcomingLabs[0];
        const formattedDate = new Date(nextLab.date).toDateString();
        const daysUntilNextLab = Math.ceil((new Date(nextLab.date) - new Date(today)) / (1000 * 60 * 60 * 24));
        const message = `Your next lab is ${nextLab.name} on ${formattedDate} (${daysUntilNextLab} days left).\nComment: ${nextLab.comment}`;
        bot.sendMessage(chatId, message);
    } catch (err) {
        console.error(err);
        bot.sendMessage(chatId, 'Failed to fetch the next lab.');
    }
});

// /updatelabdate command to update lab date or notes
bot.onText(/\/updatelabdate/, (msg) => {
    const chatId = msg.chat.id;

    if (!labScheduleDB[chatId]) {
        labScheduleDB[chatId] = new sqlite3.Database(`labschedule_${chatId}.db`);
    }

    labScheduleDB[chatId].all(`SELECT * FROM labschedule`, (err, labs) => {
        if (err) {
            console.error(err);
            bot.sendMessage(chatId, 'Failed to fetch the lab schedule.');
            return;
        }

        if (labs.length === 0) {
            bot.sendMessage(chatId, 'No labs found in the schedule.');
            return;
        }

        // Select the first five labs
        const firstFiveLabs = labs.slice(0, 5);

        const keyboard = {
            reply_markup: {
                inline_keyboard: firstFiveLabs.map(lab => [{ text: lab.name, callback_data: `changelab_${lab.id}` }])
            }
        };

        bot.sendMessage(chatId, 'Choose a lab to change:', keyboard)
            .then(() => {
                bot.once('callback_query', (query) => {
                    const labId = parseInt(query.data.split('_')[1]);
                    const selectedLab = labs.find(lab => lab.id === labId);

                    bot.sendMessage(chatId, `What do you want to change for ${selectedLab.name}?`, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Change Date', callback_data: `changedate_${labId}` }],
                                [{ text: 'Change Notes', callback_data: `changenotes_${labId}` }],
                                [{ text: 'Change Both', callback_data: `changeboth_${labId}` }]
                            ]
                        }
                    });

                    bot.once('callback_query', (query) => {
                        const action = query.data.split('_')[0];
                        if (action === 'changedate') {
                            bot.sendMessage(chatId, `Enter the new date for ${selectedLab.name} (YYYY-MM-DD):`)
                                .then(() => {
                                    bot.once('text', (msg) => {
                                        const newDate = msg.text.trim();
                                        labScheduleDB[chatId].run(`UPDATE labschedule SET date = ? WHERE id = ?`, [newDate, labId], (err) => {
                                            if (err) {
                                                console.error(err);
                                                bot.sendMessage(chatId, 'Failed to update lab schedule.');
                                            } else {
                                                bot.sendMessage(chatId, `${selectedLab.name} date changed successfully.`);
                                            }
                                        });
                                    });
                                });
                        } else if (action === 'changenotes') {
                            bot.sendMessage(chatId, `Enter the new notes for ${selectedLab.name}:`)
                                .then(() => {
                                    bot.once('text', (msg) => {
                                        const newNotes = msg.text.trim();
                                        labScheduleDB[chatId].run(`UPDATE labschedule SET comment = ? WHERE id = ?`, [newNotes, labId], (err) => {
                                            if (err) {
                                                console.error(err);
                                                bot.sendMessage(chatId, 'Failed to update lab schedule.');
                                            } else {
                                                bot.sendMessage(chatId, `${selectedLab.name} notes changed successfully.`);
                                            }
                                        });
                                    });
                                });
                        } else if (action === 'changeboth') {
                            bot.sendMessage(chatId, `Enter the new date for ${selectedLab.name} (YYYY-MM-DD):`)
                                .then(() => {
                                    bot.once('text', (msg) => {
                                        const newDate = msg.text.trim();
                                        bot.sendMessage(chatId, `Enter the new notes for ${selectedLab.name}:`)
                                            .then(() => {
                                                bot.once('text', (msg) => {
                                                    const newNotes = msg.text.trim();
                                                    labScheduleDB[chatId].run(`UPDATE labschedule SET date = ?, comment = ? WHERE id = ?`, [newDate, newNotes, labId], (err) => {
                                                        if (err) {
                                                            console.error(err);
                                                            bot.sendMessage(chatId, 'Failed to update lab schedule.');
                                                        } else {
                                                            bot.sendMessage(chatId, `${selectedLab.name} date and notes changed successfully.`);
                                                        }
                                                    });
                                                });
                                            });
                                    });
                                });
                        }
                    });
                });
            });
    });
});

//////////////////////////////////////////////////////////////

// Create or open the deadlineDB database
const deadlineDB = {};



bot.onText(/\/creatdeadline/, (msg) => {
    const chatId = msg.chat.id;

    deadlineDB[chatId] = new sqlite3.Database(`deadlineDB_${chatId}.db`);

    bot.sendMessage(chatId, 'Enter the deadline date (YYYY-MM-DD HH:MM):');
    bot.once('text', (dateMsg) => {
        const date = dateMsg.text.trim();
        bot.sendMessage(chatId, 'Enter the deadline description:');
        bot.once('text', (descMsg) => {
            const description = descMsg.text.trim();

            deadlineDB[chatId].run('INSERT INTO deadlines (date, description) VALUES (?, ?)', [date, description], (err) => {
                if (err) {
                    console.error(err.message);
                    bot.sendMessage(chatId, 'Failed to create deadline.');
                } else {
                    bot.sendMessage(chatId, 'Deadline created successfully.');
                }
            });
        });
    });
});

bot.onText(/\/deletedeadline/, (msg) => {
    const chatId = msg.chat.id;
  
    deadlineDB[chatId] = new sqlite3.Database(`deadlineDB_${chatId}.db`);

    deadlineDB[chatId].all('SELECT * FROM deadlines', (err, rows) => {
        if (err) {
            console.error(err.message);
            bot.sendMessage(chatId, 'Failed to fetch deadlines.');
            return;
        }

        if (rows.length === 0) {
            bot.sendMessage(chatId, 'There are no deadlines to delete.');
            return;
        }

        let deleteOptions = rows.map((row, index) => `${index + 1}. Date: ${row.date}, Description: ${row.description}`).join('\n');
        deleteOptions += '\n\nReply with the number of the deadline you want to delete:';
        bot.sendMessage(chatId, deleteOptions);

        bot.once('text', (deleteMsg) => {
            const index = parseInt(deleteMsg.text.trim()) - 1;
            if (index >= 0 && index < rows.length) {
                const id = rows[index].id;
                deadlineDB[chatId].run('DELETE FROM deadlines WHERE id = ?', [id], (err) => {
                    if (err) {
                        console.error(err.message);
                    } else {
                        bot.sendMessage(chatId, 'Deadline deleted successfully.');
                    }
                });
            } else {
                bot.sendMessage(chatId, 'Invalid deadline number.');
            }
        });
    });
});

bot.onText(/\/deadlines/, (msg) => {
    const chatId = msg.chat.id;
  
    deadlineDB[chatId] = new sqlite3.Database(`deadlineDB_${chatId}.db`);
    deadlineDB[chatId].all('SELECT * FROM deadlines', (err, rows) => {
        if (err) {
            console.error(err.message);
            bot.sendMessage(chatId, 'Failed to fetch deadlines.');
            return;
        }

        if (rows.length > 0) {
            const now = new Date();
            const deadlineMessages = [];
            const daysLeft = [];

            rows.forEach((row, index) => {
                const deadlineDate = new Date(row.date);
                const daysUntilDeadline = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));
                const formattedDate = deadlineDate.toDateString();
                
                deadlineMessages.push(`${formattedDate}, Description: ${row.description} (${daysUntilDeadline} days left)`);
                daysLeft.push(daysUntilDeadline);
            });

            // Sort both deadlineMessages and daysLeft based on daysLeft
            const sortedIndex = daysLeft.map((_, i) => i).sort((a, b) => daysLeft[a] - daysLeft[b]);
            const sortedDeadlineMessages = sortedIndex.map((i, index) => `${index + 1}. ${deadlineMessages[i]}`);

            bot.sendMessage(chatId, 'Deadlines:\n' + sortedDeadlineMessages.join('\n'));
            bot.sendSticker(chatId, 'CAACAgIAAxkBAAITjGdAe307r9yeeu2mDpwILUw_S-OXAAIcPQACyV2RSbHxq4SA58UxNgQ');
        } else {
            bot.sendMessage(chatId, 'There are no deadlines.');
            bot.sendMessage(chatId, 'CAACAgIAAxkBAAITjmdAe8IVl9sinh4hZJgL0USsa4QDAAKtPwAC6jEwSlZKOcbmQ7ifNgQ');
        }
    });
});

// Close the database connection when the bot is stopped
bot.on('polling_error', (error) => {
    console.error(error);
    Object.values(deadlineDB).forEach(db => db.close());
    process.exit(1);
});

process.once('SIGINT', () => {
    Object.values(deadlineDB).forEach(db => db.close());
    process.exit();
});

process.once('SIGTERM', () => {
    Object.values(deadlineDB).forEach(db => db.close());
    process.exit();
});


// Close the database connection when the bot is stopped
bot.on('polling_error', (error) => {
    console.error(error);
    Object.values(deadlineDB).forEach(db => db.close());
    process.exit(1);
});

process.once('SIGINT', () => {
    Object.values(deadlineDB).forEach(db => db.close());
    process.exit();
});

process.once('SIGTERM', () => {
    Object.values(deadlineDB).forEach(db => db.close());
    process.exit();
});
/////////////////////////////////////////////////////////////////////////////////////////////
const imageDB = {};

// Command to upload an image
bot.onText(/\/uploadimage/, (msg) => {
    const chatId = msg.chat.id;
  
   if (!imageDB[chatId]) {
        imageDB[chatId] = new sqlite3.Database(`imageDB_${chatId}.db`);
   }
  
    bot.sendMessage(chatId, 'Please send the image you want to upload.');

    bot.on('photo', (msg) => {
        const photo = msg.photo[0].file_id;
        imageDB[chatId].run(`INSERT INTO images (image) VALUES (?)`, [photo], (err) => {
            if (err) {
                console.error(err);
                bot.sendMessage(chatId, 'Failed to upload image.');
            } else {
                bot.sendMessage(chatId, 'Image uploaded successfully.');
            }
        });
    });
});


bot.onText(/\/myimage/, (msg) => {
    const chatId = msg.chat.id;
    const db = new sqlite3.Database(`imageDB_${chatId}.db`);

    db.serialize(() => {
        db.get("SELECT image FROM images", (err, row) => {
            if (err) {
                console.error(err);
                bot.sendMessage(chatId, 'Failed to fetch image try ussing /start command.');
                db.close();
                return;
            }

            const photo = row && row.image;
            if (photo) {
                bot.sendPhoto(chatId, photo);
            } else {
                bot.sendMessage(chatId, 'You have not uploaded any image yet.');
            }
            db.close();
        });
    });
});

bot.onText(/\/removeimage/, (msg) => {
    const chatId = msg.chat.id;
    const db = new sqlite3.Database(`imageDB_${chatId}.db`);

    db.serialize(() => {
        db.run("DELETE FROM images", (err) => {
            if (err) {
                console.error(err);
                bot.sendMessage(chatId, 'Failed to remove image.');
            } else {
                bot.sendMessage(chatId, 'Image removed successfully.');
            }
            db.close();
        });
    });
});
//////////////////////////////////////////////////////////////////////////////////
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    initializeTodoListDatabase(chatId); // Ensure the to-do database is initialized
  //////////////////////////////////////////////////////////////////////////////
    userDB.run(`INSERT OR IGNORE INTO users (chatId) VALUES (?)`, [chatId]);
  ////////////////////////////////////////////////////////////////////////////
   if (!imageDB[chatId]) {
        imageDB[chatId] = new sqlite3.Database(`imageDB_${chatId}.db`);
        imageDB[chatId].run(`CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image TEXT
        )`);
   }
  ///////////////////////////////////////////////////////////////////////////////////
   // Create the deadlineDB if it doesn't exist
    if (!deadlineDB[chatId]) {
        deadlineDB[chatId] = new sqlite3.Database(`deadlineDB_${chatId}.db`);
        deadlineDB[chatId].serialize(() => {
            deadlineDB[chatId].run(`CREATE TABLE IF NOT EXISTS deadlines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT,
                description TEXT
            )`);
        });
    }
  ////////////////////////////////////////////////////////////////////////////////////
   if (!labScheduleDB[chatId]) {
        labScheduleDB[chatId] = new sqlite3.Database(`labschedule_${chatId}.db`);
        labScheduleDB[chatId].run(`CREATE TABLE IF NOT EXISTS labschedule (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            name TEXT,
            comment TEXT
        )`);

        // Insert initial lab schedule data if the table is empty
        labScheduleDB[chatId].serialize(() => {
            const stmt = labScheduleDB[chatId].prepare("INSERT INTO labschedule (date, name, comment) VALUES (?, ?, ?)");
            labSchedule.forEach(lab => {
                stmt.run(lab.date, lab.name, lab.comment);
            });
            stmt.finalize();
        });
    }
  /////////////////////////////////////////////////////////////////////////////////////
  if (!mainscheduleDB[chatId]) {
        mainscheduleDB[chatId] = new sqlite3.Database(`mainschedule_${chatId}.db`);
        mainscheduleDB[chatId].run("CREATE TABLE IF NOT EXISTS schedule (day TEXT PRIMARY KEY, classes TEXT)");

        // Insert initial schedule data if the table is empty
        mainscheduleDB[chatId].get("SELECT COUNT(*) AS count FROM schedule", (err, row) => {
            if (err) {
                console.error(err.message);
                return;
            }

            if (row.count === 0) {
                mainscheduleDB[chatId].serialize(() => {
                    const stmt = mainscheduleDB[chatId].prepare("INSERT INTO schedule (day, classes) VALUES (?, ?)");
                    Object.entries(schedule).forEach(([day, classes]) => {
                        stmt.run(day, classes);
                    });
                    stmt.finalize();
                });
            }
        });
    }
  ////////////////////////////////////////////////////////////////////////////////////
    // Check if a database for this user already exists
    if (!db[chatId]) {
        // If not, create a new database for this user
        db[chatId] = new sqlite3.Database(`botdata_${chatId}.db`);
        
        // Create the links table if it doesn't exist
        db[chatId].serialize(() => {
            db[chatId].run("CREATE TABLE IF NOT EXISTS links (type TEXT, link TEXT)");

            // Insert the main schedule link
            db[chatId].run("INSERT INTO links (type, link) VALUES (?, ?)", ['main', 'https://www.google.com/']);

            // Insert the lab schedule link
            db[chatId].run("INSERT INTO links (type, link) VALUES (?, ?)", ['lab', 'https://www.google.com/']);
        });
    }

    // Send a welcome message
    bot.sendMessage(chatId, 'Welcome! Use /help to see the list of available commands.');
});
/////////////////////////////////////////////////////////////////////////////////////////
//bot.onText(/\/hi/, (msg) => {
   // const chatId = msg.chat.id;
   // bot.sendMessage(chatId, 'Hi shahd!');
//});

//////////////////////////////////////////////////////////////////////////////////////
// Define available commands
const commands = [
    '/start - Set up the bot and connect your personal database. Use this command to initialize your data and ensure all other commands work properly.',
    
    // Schedule-related commands
    '/changedayschedule - Update the schedule for specific days of the week. This is required to make the /todayschedule and /tomorrowschedule commands work correctly.',
    '/todayschedule - View today\'s class schedule. For example, if today is Monday, this command will show Monday\'s schedule.',
    '/tomorrowschedule - View tomorrow\'s class schedule. For example, if tomorrow is Monday, this command will show Monday\'s schedule.',
    '/changeschedulelinks - Update the link to your full class schedule if it changes or gets updated by your institution.',  
    '/schedule - Get a link to your full class schedule for quick access.',
    

    // Lab-related commands
    '/updatelabdate - Update your lab schedule to ensure the /nextlab command provides accurate information. For example, if your lab date changes, use this command.',
    '/nextlab - Get details about your next lab session, including the date and description.',

    // Deadline management
    '/createdeadline - Add a new deadline to keep track of important tasks or events, such as project submissions or exams.',
    '/deletedeadline - Remove a deadline from your list if it\'s no longer relevant.',
    '/deadlines - View all the deadlines you\'ve created, along with their descriptions and dates.',

    // Image management
    '/uploadimage - Save an image with the bot for future reference, such as your midterm or final exam timetable.',
    '/myimage - Retrieve and view the image you uploaded earlier.',
    '/removeimage - Delete the image you saved if it\'s outdated or no longer needed.',

    // To-do list management
    '/todoenable - Turn the auto-adjustment feature for the to-do list on or off. When enabled, the bot will add todays schedule to the to do list every day at 12AM.',
    '/todolist - show tasks that is in your to-do list . Tasks will remain until you mark them as done.',
    '/tododone - Mark tasks as completed, one at a time. Completed tasks will be removed from the list.',

    // Data management and help
    '/deletedata - Delete all your stored data, including deadlines, lab schedules, and day schedules. Use this if you want to completely reset your database.',
    '/help - Show this help menu with detailed explanations of all available commands.',

    'Note: If you need to remove a lab from your schedule, use the /updatelabdate command and set a far future date, or type "no lab" in the description. If the server is updated, make sure to use the /start command again to reconnect your data.'
];


bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Available commands:\n' + commands.join('\n'));
});
//////////////////////////////////////////////////////////////////////////////////
bot.onText(/\/deletedata/, (msg) => {
    const chatId = msg.chat.id;
  
    // Check if labScheduleDB is initialized for the chatId
    if (!labScheduleDB[chatId]) {
        console.error("labScheduleDB is not initialized for chatId", chatId);
        bot.sendMessage(chatId, 'Failed to reset lab schedule. Database not initialized.');
        return;
    }

    // Delete lab schedule data
    labScheduleDB[chatId].run(`DELETE FROM labschedule`, (err) => {
        if (err) {
            console.error(err);
            bot.sendMessage(chatId, 'Failed to delete lab schedule.');
            return;
        }
      });

    // Check if mainscheduleDB is initialized for the chatId
    if (!mainscheduleDB[chatId]) {
        console.error("mainscheduleDB is not initialized for chatId", chatId);
        bot.sendMessage(chatId, 'Failed to delete main schedule. Database not initialized.');
        return;
    }

    // Delete main schedule data
    mainscheduleDB[chatId].run(`DELETE FROM schedule`, (err) => {
        if (err) {
            console.error(err);
            bot.sendMessage(chatId, 'Failed to delete main schedule.');
            return;
        }
    });

    // Check if deadlineDB is initialized for the chatId
    if (!deadlineDB[chatId]) {
        console.error("deadlineDB is not initialized for chatId", chatId);
        bot.sendMessage(chatId, 'Failed to delete deadlines. Database not initialized.');
        return;
    }

    // Delete deadlines data
    deadlineDB[chatId].run(`DELETE FROM deadlines`, (err) => {
        if (err) {
            console.error(err);
            bot.sendMessage(chatId, 'Failed to delet deadlines.');
            return;
          
        }
        bot.sendMessage(chatId, 'all your data deleted successfully type /start to start fresh.');
    });
});

bot.onText(/\hi/, (msg) => {
    const chatId = msg.chat.id;

    
   // Replace with a valid sticker file_id or URL
    const stickerId = 'CAACAgIAAxkBAAIThWdAeki61qjwM26ossd4Rn644ILhAAIxNAAC6BugStKvp8RmJqK8NgQ';

    bot.sendSticker(chatId, stickerId);
    bot.sendMessage(chatId, 'how can i help you today');
});


bot.onText(/\Hi/, (msg) => {
    const chatId = msg.chat.id;

    
   // Replace with a valid sticker file_id or URL
    const stickerId = 'CAACAgIAAxkBAAIThWdAeki61qjwM26ossd4Rn644ILhAAIxNAAC6BugStKvp8RmJqK8NgQ';

    bot.sendSticker(chatId, stickerId);
    bot.sendMessage(chatId, 'how can i help you today');
});

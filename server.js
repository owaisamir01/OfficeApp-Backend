
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const app = express();
const cors = require('cors');
app.use(cors());
app.use(bodyParser.json());
const util = require("util");

// Creating a MySQL connection.
const pool = mysql.createPool({
  host: "sql12.freesqldatabase.com",
  user: "sql12780712",
  password: "HFi1u4g1j3",
  database: "sql12780712" // Add your database name here
});
pool.query = util.promisify(pool.query);
// con.connect(function(err) {
//   if (err) throw err;
//   console.log("Connected to the database!");
// });

pool.getConnection((err, connection) => {
  if (err) {
      console.error('Error connecting to the database:', err.message);
  } else {
      console.log('Connected to the MySQL database successfully!');
      connection.release(); // Release the connection after checking
  }
});

app.post('/adduser', function (req, res) {
    const { name, number, email, password, designation, companyname } = req.body;
    console.log("Received data:", req.body);
  
    // Check if email already exists
    const checkQuery = 'SELECT * FROM users WHERE email = ?';
    pool.query(checkQuery, [email], function (checkError, checkResults) {
      if (checkError) {
        console.error("Error checking existing user: ", checkError);
        res.status(500).send("An error occurred while checking the user.");
        return;
      }
  
      if (checkResults.length > 0) {
        res.status(409).json({
          message: "User with this email already exists."
        });
        return;
      }
  
      // Token generate karo — simple unique value
      const userToken = Date.now().toString(36) + Math.random().toString(36).substr(2);
  
      // Insert new user with token
      const insertQuery = 'INSERT INTO users (uname, number, email, password, designation, companyname, usertoken) VALUES (?, ?, ?, ?, ?, ?, ?)';
      pool.query(insertQuery, [name, number, email, password, designation, companyname, userToken], function (insertError, insertResults) {
        if (insertError) {
          console.error("Error inserting user: ", insertError);
          res.status(500).send("An error occurred while inserting the user.");
          return;
        }
  
        res.status(201).json({
          message: "User added successfully!",
        });
      });
    });
  });
  
  
  

//handle login functionality
app.post('/login', function (req, res) {
  const { email, password } = req.body;
  // console.log("Received data:", req.body);
  // Construct the SQL query to find the user by email
  const query = 'SELECT * FROM users WHERE email = ?';
  // Executing the MySQL query to check if the user exists
  pool.query(query, [email], function (error, results) {
    if (error) {
      console.error("Error checking user: ", error);
      res.status(500).send("An error occurred while checking the user.");
      return;
    }

    if (results.length === 0) {
      // User does not exist
      res.status(404).json({
        message: "Invalid Email.",
      });
      return;
    }

    const user = results[0];

    // Verify the password
    if (user.password === password) {
      res.status(200).json({
        message: "Login successful!",
        user: {
      
         token: user.usertoken,
          
          // Include any other user details you want to send
        },
      });
    } else {
      res.status(401).json({
        message: "Incorrect password.",
      });
    }
  });
});

app.post('/getuser', function (req, res) {
  const { usertoken } = req.body;
  console.log("Received request to fetch user with usertoken:", usertoken);

  const query = 'SELECT * FROM users WHERE usertoken = ?';

  pool.query(query, [usertoken], function (error, results) {
    if (error) {
      console.error("Error fetching user: ", error);
      res.status(500).json({
        message: "An error occurred while fetching the user."
      });
      return;
    }

    if (results.length === 0) {
      res.status(404).json({
        message: "User not found with the provided usertoken."
      });
      return;
    }

    res.status(200).json({
      message: "User fetched successfully!",
      userData: results[0]
    });
  });
});

app.post('/addpost', function (req, res) {
  const { userid, post } = req.body;  // Extract 'userid' and 'post' from the request body
  console.log("Received data:", req.body);

  // Define the SQL query to insert data into the 'posts' table
  const query = 'INSERT INTO posts (userid, postbody) VALUES (?, ?)';

  // Execute the MySQL query to insert data
  pool.query(query, [userid, post], function (error, results) {
    if (error) {
      console.error("Error inserting post: ", error);
      res.status(500).send("An error occurred while inserting the post.");
      return;
    }

    // Send a success response if no errors occurred
    res.status(201).json({
      message: "Post added successfully!"
    });
  });
});

app.post('/savebill', function (req, res) {
  const { usertoken, date, area, shopName, items, totalBill } = req.body; // Extract data from request body
  console.log("Received bill data:", req.body);

  // Validate the incoming data
  if (!usertoken || !date || !area || !shopName || !items.length || totalBill <= 0) {
    return res.status(400).json({ message: 'Invalid bill data.' });
  }

  // Define the SQL query to insert data into the 'bills' table
  const billQuery = 'INSERT INTO bills (usertoken, date, area, shop_name, total_bill) VALUES (?, ?, ?, ?, ?)';

  // Insert the bill into the 'bills' table
  pool.query(billQuery, [usertoken, date, area, shopName, totalBill], function (error, billResult) {
    if (error) {
      console.error("Error inserting bill: ", error);
      return res.status(500).json({ message: 'Failed to save bill.' });
    }

    const billId = billResult.insertId; // Get the ID of the newly inserted bill

    // Define the SQL query to insert items into the 'bill_items' table
    const itemQuery = 'INSERT INTO bill_items (bill_id, item_name, quantity, price, total) VALUES (?, ?, ?, ?, ?)';

    // Insert each item into the 'bill_items' table
    let itemsInserted = 0;
    items.forEach(item => {
      pool.query(itemQuery, [billId, item.name, item.quantity, item.price, item.total], function (itemError) {
        if (itemError) {
          console.error("Error inserting bill item: ", itemError);
          return res.status(500).json({ message: 'Failed to save bill items.' });
        }

        itemsInserted++;
        // If all items are inserted successfully, send the success response
        if (itemsInserted === items.length) {
          res.status(201).json({ message: 'Bill saved successfully!' });
        }
      });
    });
  });
});


app.post('/getbills', function (req, res) {
  const { usertoken } = req.body;
  console.log("Received usertoken:", req.body);

  if (!usertoken) {
    return res.status(400).json({ message: 'No usertoken provided.' });
  }

  const query = 'SELECT * FROM bills WHERE usertoken = ?';
  pool.query(query, [usertoken], function (error, results) {
    if (error) {
      console.error("Error fetching bills: ", error);
      return res.status(500).json({ message: 'Failed to fetch bills.' });
    }

    res.status(200).json({ bills: results });
  });
});

app.post('/getbillitems', function (req, res) {
  const { bill_id } = req.body;
  console.log("Received bill_id:", req.body);

  if (!bill_id) {
    return res.status(400).json({ message: 'No bill_id provided.' });
  }

  const query = 'SELECT * FROM bill_items WHERE bill_id = ?';
  pool.query(query, [bill_id], function (error, results) {
    if (error) {
      console.error("Error fetching bill items: ", error);
      return res.status(500).json({ message: 'Failed to fetch bill items.' });
    }

    res.status(200).json({ items: results });
  });
});

app.post('/updatebill', function (req, res) {
  const { bill_id, date, area, shop_name, total_bill, items } = req.body;
  console.log("Received update data:", req.body);

  if (!bill_id || !date || !area || !shop_name || !total_bill || !items) {
    return res.status(400).json({ message: 'Invalid update data.' });
  }

  // Update the bill in the bills table
  pool.query(
    'UPDATE bills SET date = ?, area = ?, shop_name = ?, total_bill = ? WHERE bill_id = ?',
    [date, area, shop_name, total_bill, bill_id],
    function (error) {
      if (error) {
        console.error("Error updating bill: ", error);
        return res.status(500).json({ message: 'Failed to update bill.' });
      }

      // Update each item in the bill_items table
      const itemQuery = 'UPDATE bill_items SET item_name = ?, quantity = ?, price = ?, total = ? WHERE item_id = ? AND bill_id = ?';
      let itemsUpdated = 0;
      items.forEach(item => {
        if (!item.item_id) {
          console.error("Missing item_id for item:", item);
          return res.status(400).json({ message: 'Missing item_id in one or more items.' });
        }
        pool.query(
          itemQuery,
          [item.item_name, item.quantity, item.price, item.total, item.item_id, bill_id],
          function (itemError) {
            if (itemError) {
              console.error("Error updating bill item: ", itemError);
              return res.status(500).json({ message: 'Failed to update bill items.' });
            }
            itemsUpdated++;
            if (itemsUpdated === items.length) {
              res.status(200).json({ message: 'Bill updated successfully!' });
            }
          }
        );
      });
    }
  );
});

app.post('/deletebill', function (req, res) {
  const { bill_id } = req.body;
  console.log("Received delete request for bill_id:", req.body);

  if (!bill_id) {
    return res.status(400).json({ message: 'No bill_id provided.' });
  }

  // First, delete all items associated with the bill from the bill_items table
  pool.query('DELETE FROM bill_items WHERE bill_id = ?', [bill_id], function (error) {
    if (error) {
      console.error("Error deleting bill items: ", error);
      return res.status(500).json({ message: 'Failed to delete bill items.' });
    }

    // Then, delete the bill from the bills table
    pool.query('DELETE FROM bills WHERE bill_id = ?', [bill_id], function (error) {
      if (error) {
        console.error("Error deleting bill: ", error);
        return res.status(500).json({ message: 'Failed to delete bill.' });
      }

      res.status(200).json({ message: 'Bill and its items deleted successfully!' });
    });
  });
});

// app.post('/getstats', function (req, res) {
//   const { usertoken } = req.body;

//   if (!usertoken) {
//     return res.status(400).json({ message: 'No usertoken provided.' });
//   }

//   // Step 1: Validate usertoken and fetch stats directly from bills table
//   con.query(
//     'SELECT ' +
//       'COUNT(DISTINCT bill_id) as totalBills, ' +
//       'SUM(total_bill) as totalAmount, ' +
//       'AVG(total_bill) as averageAmount, ' +
//       'MAX(total_bill) as highestBill, ' +
//       '(SELECT shop_name FROM bills WHERE usertoken = ? GROUP BY shop_name ORDER BY COUNT(*) DESC LIMIT 1) as frequentShop, ' +
//       '(SELECT COUNT(*) FROM bill_items bi JOIN bills b2 ON bi.bill_id = b2.bill_id WHERE b2.usertoken = ?) as totalItems ' +
//     'FROM bills ' +
//     'WHERE usertoken = ?',
//     [usertoken, usertoken, usertoken],
//     function (error, statsResult) {
//       if (error) {
//         console.error("Error fetching stats: ", error);
//         return res.status(500).json({ message: 'Failed to fetch stats.' });
//       }

//       const stats = {
//         totalBills: statsResult[0].totalBills || 0,
//         totalAmount: parseFloat(statsResult[0].totalAmount || 0).toFixed(2),
//         averageAmount: parseFloat(statsResult[0].averageAmount || 0).toFixed(2),
//         highestBill: parseFloat(statsResult[0].highestBill || 0).toFixed(2),
//         frequentShop: statsResult[0].frequentShop || 'N/A',
//         totalItems: statsResult[0].totalItems || 0,
//       };
//       res.status(200).json({ stats });
//     }
//   );
// });

app.post('/getstats', function (req, res) {
  const { usertoken, date } = req.body;

  if (!usertoken) {
    return res.status(400).json({ message: 'No usertoken provided.' });
  }

  // Prepare the base query with date filter
  let query = `
    SELECT 
      COUNT(DISTINCT bill_id) as totalBills, 
      SUM(total_bill) as totalAmount, 
      AVG(total_bill) as averageAmount, 
      MAX(total_bill) as highestBill, 
      (SELECT shop_name FROM bills WHERE usertoken = ? AND DATE(created_at) = ? GROUP BY shop_name ORDER BY COUNT(*) DESC LIMIT 1) as frequentShop, 
      (SELECT COUNT(*) FROM bill_items bi JOIN bills b2 ON bi.bill_id = b2.bill_id WHERE b2.usertoken = ? AND DATE(b2.created_at) = ?) as totalItems 
    FROM bills 
    WHERE usertoken = ? AND DATE(created_at) = ?
  `;

  const queryParams = [usertoken, date, usertoken, date, usertoken, date];

  // If no date is provided, remove the date filter (optional fallback)
  if (!date) {
    query = `
      SELECT 
        COUNT(DISTINCT bill_id) as totalBills, 
        SUM(total_bill) as totalAmount, 
        AVG(total_bill) as averageAmount, 
        MAX(total_bill) as highestBill, 
        (SELECT shop_name FROM bills WHERE usertoken = ? GROUP BY shop_name ORDER BY COUNT(*) DESC LIMIT 1) as frequentShop, 
        (SELECT COUNT(*) FROM bill_items bi JOIN bills b2 ON bi.bill_id = b2.bill_id WHERE b2.usertoken = ?) as totalItems 
      FROM bills 
      WHERE usertoken = ?
    `;
    queryParams = [usertoken, usertoken, usertoken];
  }

  pool.query(query, queryParams, function (error, statsResult) {
    if (error) {
      console.error("Error fetching stats: ", error);
      return res.status(500).json({ message: 'Failed to fetch stats.' });
    }

    const stats = {
      totalBills: statsResult[0].totalBills || 0,
      totalAmount: parseFloat(statsResult[0].totalAmount || 0).toFixed(2),
      averageAmount: parseFloat(statsResult[0].averageAmount || 0).toFixed(2),
      highestBill: parseFloat(statsResult[0].highestBill || 0).toFixed(2),
      frequentShop: statsResult[0].frequentShop || 'N/A',
      totalItems: statsResult[0].totalItems || 0,
    };
    res.status(200).json({ stats });
  });
});
app.get('/getitems', function (req, res) {
  const query = 'SELECT item_name, price,id FROM items';
  pool.query(query, function (error, results) {
    if (error) {
      console.error("Error fetching items: ", error);
      return res.status(500).json({ message: 'Failed to fetch items.' });
    }

    // Format the results to match the itemOptions structure
    const items = results.map(item => ({
      label: item.item_name,
      value: item.item_name,
      price: parseFloat(item.price),
      id: item.id
    }));

    // Add the default "Select Item" option
    items.unshift({ label: 'Select Item', value: '', price: 0 });

    res.status(200).json({ items });
  });
});

app.post('/adminlogin', function (req, res) {
  const { email, password } = req.body;
  // Simulate admin database query
  const query = 'SELECT * FROM admins WHERE email = ? AND password = ?';
  pool.query(query, [email, password], function (error, results) {
    if (error) {
      console.error("Error during admin login: ", error);
      return res.status(500).json({ message: 'Failed to login as admin.' });
    }
    if (results.length > 0) {
      const user = results[0];
      res.status(200).json({
        user: { token: 'admin-token-' + Math.random(), role: 'admin', ...user },
        message: 'Admin login successful'
      });
    } else {
      res.status(401).json({ message: 'Invalid admin credentials.' });
    }
  });
});

app.post('/getalluserswithtokens', function (req, res) {
  const query = 'SELECT uname, usertoken FROM users'; // Adjust table name as per your schema
  pool.query(query, function (error, results) {
    if (error) {
      console.error("Error fetching users: ", error);
      return res.status(500).json({ message: 'Failed to fetch users.' });
    }
    const users = results.map(row => ({ uname: row.uname, token: row.usertoken }));
    console.log("Fetched users:", users);
    res.status(200).json({ users });
  });
});
app.post('/additem', function (req, res) {
  const { item_name, price } = req.body;
  const query = 'INSERT INTO items (item_name, price) VALUES (?, ?)';
  pool.query(query, [item_name, parseFloat(price)], function (error, results) {
    if (error) {
      console.error("Error adding item: ", error);
      return res.status(500).json({ message: 'Failed to add item.' });
    }
    res.status(200).json({ message: 'Item added successfully.' });
  });
});
app.post('/deleteitem', function (req, res) {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ message: 'No item ID provided.' });
  }
  const query = 'DELETE FROM items WHERE id = ?';
  pool.query(query, [id], function (error, results) {
    if (error) {
      console.error("Error deleting item: ", error);
      return res.status(500).json({ message: 'Failed to delete item.' });
    }
    if (results.affectedRows > 0) {
      res.status(200).json({ message: 'Item deleted successfully.' });
    } else {
      res.status(404).json({ message: 'Item not found.' });
    }
  });
});
// Starting our server.
app.listen(3001, () => {
  console.log('Server is running on http://localhost:3001');
});

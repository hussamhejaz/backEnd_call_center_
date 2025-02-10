const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./firebase'); // Adjust this path as necessary

const app = express();
const PORT = process.env.PORT || 10000;


const allowedOrigins = ['https://callcentersy.netlify.app', 'http://localhost:3000'];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH,  OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');  // Required for cookies and auth headers
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);  // Respond to preflight requests immediately
  } else {
    next();
  }
});

app.use(bodyParser.json()); 






// Endpoint: Fetch estate with owner details
app.get('/estate-with-owner/:estateId', async (req, res) => {
  const { estateId } = req.params;
  console.log(`Fetching estate with ID: ${estateId}`);

  try {
    const categories = ['Coffee', 'Hottel', 'Restaurant'];
    let estateData = null;

    for (const category of categories) {
      console.log(`Searching in category: ${category} for estate ID: ${estateId}`);
      const estateSnapshot = await db.ref(`App/Estate/${category}/${estateId}`).once('value');
      if (estateSnapshot.exists()) {
        estateData = estateSnapshot.val();
        console.log(`Estate found in category ${category}:`, estateData);
        break;
      }
    }

    if (!estateData) {
      return res.status(404).json({ message: 'Estate not found' });
    }

    const providerId = estateData.IDUser;
    const providerSnapshot = await db.ref(`App/User/${providerId}`).once('value');
    if (!providerSnapshot.exists()) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    const providerData = providerSnapshot.val();
    const response = {
      estate: estateData,
      provider: providerData,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching estate and provider data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint: Fetch provider by ID and associated estates
app.get('/providers/:id', async (req, res) => {
  const providerId = req.params.id;
  try {
    console.log(`Fetching provider with ID: ${providerId}`);

    const userSnapshot = await db.ref(`App/User/${providerId}`).once('value');
    const user = userSnapshot.val();

    if (!user) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    if (user.TypeUser !== '2') {
      return res.status(404).json({ message: 'User is not a provider' });
    }

    const estateSnapshot = await db.ref('App/Estate').once('value');
    const estates = estateSnapshot.val();
    const providerEstates = [];

    for (const estateKey in estates) {
      for (const subKey in estates[estateKey]) {
        const estate = estates[estateKey][subKey];
        if (estate.IDUser === providerId) {
          providerEstates.push({
            id: subKey,
            companyName: estate.NameEn || 'Unknown Company',
            industry: estate.BioEn || estate.BioAr || 'Unknown Industry',
            type: estate.Type || 'Unknown Type',
            providerName: estate["Owner of Estate Name"] || 'Unknown Provider',
          });
        }
      }
    }

    const response = {
      userId: providerId,
      firstName: user.FirstName || 'Unknown',
      lastName: user.LastName || 'Unknown',
      email: user.Email || 'No Email',
      phone: user.PhoneNumber || 'No Phone',
      gender: user.Gender || 'Unknown',
      isSmoker: user.IsSmoker || 'Unknown',
      state: user.State || 'Unknown',
      estates: providerEstates,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching provider profile:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint: Fetch all users
app.get('/allusers', async (req, res) => {
  try {
    const snapshot = await db.ref('App/User').once('value');
    if (!snapshot.exists()) {
      return res.status(404).json({ message: 'No data available' });
    }
    const users = snapshot.val();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint: Fetch user by ID with bookings
app.get('/user-with-bookings/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // Fetch user data
    const userSnapshot = await db.ref(`App/User/${userId}`).once('value');
    if (!userSnapshot.exists()) {
      return res.status(404).json({ message: 'User not found' });
    }
    const userData = userSnapshot.val();

    // Fetch bookings
    const bookingSnapshot = await db.ref('App/Booking/Book').once('value');
    const bookings = [];
    if (bookingSnapshot.exists()) {
      bookingSnapshot.forEach((childSnapshot) => {
        const booking = childSnapshot.val();
        if (booking.IDUser === userId) {
          bookings.push({
            id: childSnapshot.key,
            placeName: booking.NameEn,
            city: booking.City || 'Unknown',
            country: booking.Country || 'Unknown',
            startDate: booking.StartDate || 'N/A',
            endDate: booking.EndDate || 'N/A',
            dateOfBooking: booking.DateOfBooking || 'N/A',
            netTotal: booking.NetTotal || '0.0',
            status: booking.Status,
          });
        }
      });
    }

    // Send response with user and bookings
    const response = {
      user: userData,
      bookings: bookings, // Can be an empty array
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching user and booking data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Endpoint: Fetch customers (TypeUser = 1)
app.get('/user', async (req, res) => {
  try {
    const snapshot = await db.ref('App/User').once('value');
    if (!snapshot.exists()) {
      return res.status(404).json({ message: 'No data available' });
    }
    const users = snapshot.val();

    const filteredUsers = Object.keys(users)
      .filter(key => users[key].TypeUser === '1')
      .map(key => ({
        id: key,
        ...users[key],
        accountType: Number.parseInt(users[key].TypeAccount, 10)
      }));

    res.json(filteredUsers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('/providers', async (req, res) => {
  try {
    const snapshot = await db.ref('App/Estate').once('value');
    if (!snapshot.exists()) {
      return res.status(404).json({ message: 'No data available' });
    }
    const estates = snapshot.val();

    const providers = await Promise.all(Object.keys(estates).flatMap(key =>
      Object.keys(estates[key]).map(async subKey => {
        const estate = estates[key][subKey];

        // Filter estates where IsAccepted is "2"
        if (estate.IsAccepted !== "2") {
          return null; // Skip estates that do not match the criteria
        }

        const userSnapshot = await db.ref(`App/User/${estate.IDUser}`).once('value');
        const user = userSnapshot.val();

        return {
          id: subKey,
          companyName: estate.NameEn || 'Unknown Company',
          email: user?.Email || 'No Email',
          phone: user?.PhoneNumber || 'No Phone',
          logo: user?.ProfileImageUrl || 'https://via.placeholder.com/100',
          type: estate.Type || 'Unknown Type',
          industry: estate.BioEn || estate.BioAr || 'Unknown Industry',
          accountType: estate.TypeAccount || 'Unknown Account Type',
          providerName: estate["Owner of Estate Name"] || 'Unknown Provider',
          city: estate.City || 'Unknown City',
          country: estate.Country || 'Unknown Country',
          facilityImageUrl: estate.FacilityImageUrl || 'No Image Available',
        };
      })
    ));

    // Remove any null values from the providers array
    const filteredProviders = providers.filter(provider => provider !== null);

    res.json(filteredProviders);
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});








app.post('/feedbacks/:feedbackId/comments', async (req, res) => {
  const { feedbackId } = req.params;
  const { commentText, author } = req.body;

  // Fetch the feedback entry by feedbackId
  const feedbackRef = db.ref(`App/CustomerFeedback/${feedbackId}`);
  const feedbackSnapshot = await feedbackRef.once('value');
  const feedback = feedbackSnapshot.val();

  if (!feedback) {
    return res.status(404).json({ error: 'Feedback not found' });
  }

  // Generate a unique comment ID
  const newComment = {
    id: db.ref().push().key,
    text: commentText,
    author: author || 'Anonymous',
    timestamp: new Date().toISOString(),
  };

  // Add the new comment to the feedback's comments array
  const updatedComments = [...(feedback.comments || []), newComment];

  // Update the comments for the specific feedbackId
  await feedbackRef.update({ comments: updatedComments });

  return res.status(200).json({ comments: updatedComments });
});








app.get('/feedbacks', async (req, res) => {
  try {
    const feedbackRef = db.ref('/App/CustomerFeedback');
    const feedbackSnapshot = await feedbackRef.once('value');
    const feedbackData = feedbackSnapshot.val();

    if (!feedbackData) {
      return res.status(404).json({ message: 'No feedback found' });
    }

    let feedbackList = [];
    const categories = ['Hottel', 'Restaurant', 'Coffee'];

    for (const feedbackId in feedbackData) {
      const feedbackEntry = feedbackData[feedbackId];

      if (!feedbackEntry || typeof feedbackEntry !== 'object') {
        continue;
      }

      // Fetch the user data, including the profile picture URL and userId
      const userRef = db.ref(`/App/User/${feedbackEntry.UserID}`);
      const userSnapshot = await userRef.once('value');
      const user = userSnapshot.val();

      let estate = null;
      for (const category of categories) {
        const estateRef = db.ref(`/App/Estate/${category}/${feedbackEntry.EstateID}`);
        const estateSnapshot = await estateRef.once('value');
        if (estateSnapshot.exists()) {
          estate = estateSnapshot.val();
          break;
        }
      }

      feedbackList.push({
        feedbackId: feedbackId,
        userName: `${user.FirstName} ${user.LastName}` || 'Anonymous',
        user: {
          userId: feedbackEntry.UserID,  // Ensure userId is included
          email: user?.Email || 'No Email',
          phone: user?.PhoneNumber || 'No Phone',
          ProfileImageUrl: user?.ProfileImageUrl || 'https://via.placeholder.com/100',  // Fallback if no profile picture
        },
        estate: {
          estateId: feedbackEntry.EstateID,  // Ensure estateId is included
          NameEn: estate?.NameEn || 'Unknown Estate',
          City: estate?.City || 'Unknown City',
          Country: estate?.Country || 'Unknown Country'
        },
        feedback: feedbackEntry.feedback || 'No feedback provided',
        rating: feedbackEntry.rating || 0,
        comments: feedbackEntry.comments ? Object.values(feedbackEntry.comments) : [],
        timestamp: feedbackEntry.timestamp || ''
      });
    }

    res.json(feedbackList);
  } catch (error) {
    console.error('Error fetching feedback and estate data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});




app.get('/provider-feedback-to-customer', async (req, res) => {
  try {
    console.log('Fetching provider feedback to customer...');

    // Reference to ProviderFeedbackToCustomer in Firebase
    const feedbackRef = db.ref('/App/ProviderFeedbackToCustomer');
    const feedbackSnapshot = await feedbackRef.once('value');
    const feedbackData = feedbackSnapshot.val();

    if (!feedbackData) {
      return res.status(404).json({ message: 'No feedback found' });
    }

    let feedbackList = [];
    const categories = ['Coffee', 'Hottel', 'Restaurant'];  // Add all categories

    // Loop through each feedback entry in ProviderFeedbackToCustomer
    for (const feedbackId in feedbackData) {
      const feedbackEntry = feedbackData[feedbackId];

      if (!feedbackEntry || typeof feedbackEntry !== 'object') {
        continue;  // Skip invalid feedback entries
      }

      // Fetch ratings inside the feedback (if present)
      const ratings = feedbackEntry.ratings || {};
      let ratingDetails = {};

      // Loop through the ratings and extract the first one (or you can loop through all)
      for (const ratingId in ratings) {
        const ratingEntry = ratings[ratingId];
        ratingDetails = {
          EstateID: ratingEntry.EstateID || 'Unknown Estate ID',
          EstateName: ratingEntry.EstateName || 'Unknown Estate Name',
          comment: ratingEntry.comment || 'No comment provided',
          rating: ratingEntry.rating || 0,
          timestamp: ratingEntry.timestamp
            ? new Date(ratingEntry.timestamp).toLocaleString()
            : 'Invalid Date'
        };
        break;  // Assuming you only want the first rating, otherwise loop over all
      }

      // Fetch the estate data (including FacilityImageUrl) for the correct category
      let estateData = null;
      for (const category of categories) {
        const estateRef = db.ref(`/App/Estate/${category}/${ratingDetails.EstateID}`);
        const estateSnapshot = await estateRef.once('value');
        if (estateSnapshot.exists()) {
          estateData = estateSnapshot.val();
          break;  // Once we find the estate in any category, we stop searching
        }
      }

      feedbackList.push({
        feedbackId: feedbackId,
        CustomerName: feedbackEntry.CustomerName || 'Unknown Customer',
        averageRating: feedbackEntry.averageRating || 0,
        ratingCount: feedbackEntry.ratingCount || 0,
        estateProfileImage: estateData?.FacilityImageUrl || 'https://via.placeholder.com/150',  // Estate profile image
        ...ratingDetails  // Add the extracted rating details
      });
    }

    // Send back the constructed feedback list
    res.json(feedbackList);
  } catch (error) {
    console.error('Error fetching provider feedback:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});









app.get('/estate-bookings-with-users/:estateId', async (req, res) => {
  const { estateId } = req.params;

  try {
    const bookingSnapshot = await db.ref('App/Booking/Book').once('value');
    if (!bookingSnapshot.exists()) {
      return res.status(200).json([]);
    }

    const bookings = [];
    const bookingPromises = [];

    bookingSnapshot.forEach((childSnapshot) => {
      const booking = childSnapshot.val();
      if (booking.IDEstate === estateId) {
        const bookingDetails = {
          id: childSnapshot.key,
          placeName: booking.NameEn,
          city: booking.City || 'Unknown',
          country: booking.Country || 'Unknown',
          startDate: booking.StartDate || 'N/A',
          endDate: booking.EndDate || 'N/A',
          dateOfBooking: booking.DateOfBooking || 'N/A',
          netTotal: booking.NetTotal || '0.0',
          status: booking.Status
        };

        const userPromise = db.ref(`App/User/${booking.IDUser}`).once('value')
          .then((userSnapshot) => {
            if (userSnapshot.exists()) {
              bookingDetails.user = userSnapshot.val();
            }
          });

        bookingPromises.push(userPromise);
        bookings.push(bookingDetails);
      }
    });

    await Promise.all(bookingPromises);

    res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('/new-estate', async (req, res) => {
  try {
    const snapshot = await db.ref('App/Estate').once('value');
    if (!snapshot.exists()) {
      return res.status(404).json({ message: 'No data available' });
    }
    const estates = snapshot.val();

    const providers = await Promise.all(Object.keys(estates).flatMap(key =>
      Object.keys(estates[key]).map(async subKey => {
        const estate = estates[key][subKey];

        // Filter estates where IsAccepted is "1"
        if (estate.IsAccepted !== "1") {
          return null; // Skip estates that do not match the criteria
        }

        // Fetching the user data based on the estate's IDUser
        const userSnapshot = await db.ref(`App/User/${estate.IDUser}`).once('value');
        const user = userSnapshot.val();

        // Returning all the relevant fields including new ones like BioAr, BioEn, etc.
        return {
          id: subKey,
          companyName: estate.NameEn || 'Unknown Company',
          email: user?.Email || 'No Email',
          phone: user?.PhoneNumber || 'No Phone',
          agentCode: user?.AgentCode || 'no AgentCode',
          logo: user?.ProfileImageUrl || 'https://via.placeholder.com/100',
          type: estate.Type || 'Unknown Type',
          industry: estate.BioEn || estate.BioAr || 'Unknown Industry',
          accountType: estate.TypeAccount || 'Unknown Account Type',
          providerName: estate["Owner of Estate Name"] || 'Unknown Provider',
          city: estate.City || 'Unknown City',
          country: estate.Country || 'Unknown Country',
          state: estate.State || 'Unknown State',
          facilityPdfUrl: estate.FacilityPdfUrl|| 'No facilityPdfUrl',
          taxPdfUrl: estate.TaxPdfUrl || 'No TaxPdfUrl',
          price: estate.Price || 'Unknown',
          priceLast: estate.PriceLast || 'Unknown',
          hasKidsArea: estate.HasKidsArea === "1" ? "Yes" : "No",
          hasMassage: estate.HasMassage === "1" ? "Yes" : "No",
          hasSwimmingPool: estate.HasSwimmingPool === "1" ? "Yes" : "No",
          hasValet: estate.HasValet === "1" ? "Yes" : "No",
          valetWithFees: estate.ValetWithFees === "1" ? "Yes" : "No",
          latitude: estate.Lat || 'Unknown',
          longitude: estate.Lon || 'Unknown',
          menuLink: estate.MenuLink || 'Unknown',
          music: estate.Music === "1" ? "Yes" : "No",
          sessions: estate.Sessions || 'Unknown Sessions',
          typeofRestaurant: estate.TypeofRestaurant || 'Unknown',
          hasBarber: estate.HasBarber === "1" ? "Yes" : "No",
          hasGym: estate.HasGym === "1" ? "Yes" : "No",
        };
      })
    ));

    // Remove any null values from the providers array
    const filteredProviders = providers.filter(provider => provider !== null);

    res.json(filteredProviders);
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});




app.put('/update-isaccepted/:category/:estateId', async (req, res) => {
  const { category, estateId } = req.params;
  const { IsAccepted } = req.body;

  // Ensure newIsAccepted is a string (because it is stored as a string in Firebase)
  const acceptedValues = ["2", "3"];  // Valid values for accepted and rejected are strings
  const parsedIsAccepted = String(IsAccepted);  // Ensure the incoming value is treated as a string

  // Validate that the new isAccepted value must be either "2" or "3"
  if (!acceptedValues.includes(parsedIsAccepted)) {
    return res.status(400).json({ message: 'Invalid IsAccepted value. It must be "2" (Accepted) or "3" (Rejected).' });
  }

  try {
    const estateRef = db.ref(`App/Estate/${category}/${estateId}`);
    const estateSnapshot = await estateRef.once('value');

    if (!estateSnapshot.exists()) {
      return res.status(404).json({ message: 'Estate not found' });
    }

    const estateData = estateSnapshot.val();

    // Check if the current isAccepted is "1" (under process, stored as string)
    if (estateData.IsAccepted !== "1") {
      return res.status(400).json({ message: 'Cannot update IsAccepted. The estate is no longer under process.' });
    }

    // If rejected (IsAccepted === "3"), remove the estate from the database
    if (parsedIsAccepted === "3") {
      await estateRef.remove();  // Remove the estate from Firebase
      return res.json({ message: 'Estate has been rejected and removed from the database.' });
    }

    // If accepted (IsAccepted === "2"), update the IsAccepted value
    await estateRef.update({ IsAccepted: parsedIsAccepted });

    res.json({ message: 'Estate has been accepted.', IsAccepted: parsedIsAccepted });
  } catch (error) {
    console.error('Error updating IsAccepted value:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.get('/posts', async (req, res) => {
  try {
    const postsRef = db.ref('App/AllPosts');
    const snapshot = await postsRef.once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'No posts found.' });
    }

    const posts = snapshot.val();
    return res.status(200).json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

app.patch('/posts/:postId/status', async (req, res) => {
  const { postId } = req.params;
  const { status } = req.body;

  // Validate status
  if (!['1', '2'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value. Must be 1 (accepted) or 2 (rejected).' });
  }

  try {
    const postRef = db.ref(`App/AllPosts/${postId}`);

    // Check if post exists
    const snapshot = await postRef.once('value');
    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    // Update the status
    await postRef.update({ Status: status });

    return res.status(200).json({ message: 'Post status updated successfully.' });
  } catch (error) {
    console.error('Error updating post status:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});



app.get('/posts/:postId', async (req, res) => {
  const { postId } = req.params;

  try {
    const postRef = db.ref(`App/AllPosts/${postId}`);
    const snapshot = await postRef.once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    return res.status(200).json(snapshot.val());
  } catch (error) {
    console.error('Error fetching post:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});



app.put('/update-user-type/:userId', async (req, res) => {
  const { userId } = req.params;
  const { TypeAccount } = req.body;

  // Check if the new TypeAccount value is provided
  if (TypeAccount === undefined) {
    return res.status(400).json({ message: 'TypeAccount value is required.' });
  }

  try {
    // Reference the specific user in Firebase
    const userRef = db.ref(`App/User/${userId}`);
    const userSnapshot = await userRef.once('value');

    if (!userSnapshot.exists()) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Update the TypeAccount property
    await userRef.update({ TypeAccount: TypeAccount });
    res.json({ message: 'User TypeAccount updated successfully.' });
  } catch (error) {
    console.error('Error updating user type account:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/provider', async (req, res) => {
  try {
    const snapshot = await db.ref('App/User').once('value');
    if (!snapshot.exists()) {
      return res.status(404).json({ message: 'No data available' });
    }
    const users = snapshot.val();

    const filteredUsers = Object.keys(users)
      .filter(key => users[key].TypeUser === '2')
      .map(key => ({
        id: key,
        ...users[key],
        accountType: Number.parseInt(users[key].TypeAccount, 10)
      }));

    res.json(filteredUsers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 
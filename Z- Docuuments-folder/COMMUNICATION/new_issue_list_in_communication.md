
1) -- resolved   there is the 431 error (This page isn’t working.If the problem continues, contact the site owner.HTTP ERROR 431) on the localhost when want to run the site on the http://localhost:3000/ but on the ip address its working well on the http://192.168.12.81:3000/   and also the same code working well on the vercel hosted app with the same code and also in https://digi-era-pro.vercel.app/
check if the http://localhost:3000 is in the  blacklist/block or any other reason like the supabase issue , node server issue , rate limiter issue , mongo issue as i have clear every things related to browsers cookies or cache 
and i want to resolve this error forever and every things should be working well 

and also  In localhost the message sent is not working well while in the live in the vercel the same code is working well 


2) --not-resolved In the channels list item and user_directory (dm channels for direct messages ) and in the message notification when read the messages than those notification clean but again seen/visible the same notifications  when refresh the page and than so on 
there should be proper implementation of this one and make sure every things should be working well without anu error


3) --working in the message-list , the messages search is not working well
<input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search messages..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-muted/30 hover:bg-muted/50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleSearchNext()
                      } else if (e.key === 'Escape') {
                        handleCloseSearch()
                      }
                    }}
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
 http://localhost:3000/api/communication/messages/search?channel_id=8d48bb5c-d5de-4f3f-9ff9-f056534456b6&query=dsasadsadsadsad&limit=50&offset=0
and there should be proper search and navigation on that message works correctally just like in the whatsapp search for messages 
now this http://localhost:3000/api/communication/messages/search?channel_id=8d48bb5c-d5de-4f3f-9ff9-f056534456b6&query=dsasadsadsadsad&limit=50&offset=0
give this response 
{
    "success": true,
    "data": [],
    "meta": {
        "total": 0,
        "limit": 50,
        "offset": 0,
        "query": "dsasadsadsadsad",
        "hasMore": false
    }
}

make sure the message search should be working well in the message chat and also make sure follow the current flow of app and every things should be working well 



4) when send the message than its takes 
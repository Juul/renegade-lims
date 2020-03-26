

# Swab

* type: "swab"
* uuid
* isExternal: boolean
* isPriority: boolean
* username
* timestamp
* location

## isExternal

Was this swabbed using our swab collecting system or was it supplied by an outside company. True if outside company.

## isPriority

Should this swab be given priority?

## username

If `isExternal` is false then this needs to be set to the unique username of the logged in user on the swab collection computer.

If `isExternal` is true then this will be a unique username of a user created for the company that delivered the swab.

## timestamp

If isExternal is false then this is a the time this swab was created in the field, otherwise this is the time the swab tube was scanned after it arrived at the lab.

## location

Where this was swabbed. Not yet specified if this is coordinates, address or something else

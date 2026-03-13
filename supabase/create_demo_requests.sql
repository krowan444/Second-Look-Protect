-- Create the demo_requests table
CREATE TABLE public.demo_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name TEXT NOT NULL,
    work_email TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    organisation_name TEXT NOT NULL,
    organisation_type TEXT,
    role TEXT,
    message TEXT,
    consent BOOLEAN NOT NULL DEFAULT true,
    source_page TEXT DEFAULT 'book_demo',
    status TEXT DEFAULT 'new',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous inserts (for the public site form)
CREATE POLICY "Allow public inserts for demo requests"
ON public.demo_requests
FOR INSERT
TO public
WITH CHECK (true);

-- Create policy to allow authenticated admins to read demo requests
CREATE POLICY "Allow read access for authenticated admins"
ON public.demo_requests
FOR SELECT
TO authenticated
USING (true);

-- Grant permissions to public (anon) and authenticated roles
GRANT INSERT ON public.demo_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_requests TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
